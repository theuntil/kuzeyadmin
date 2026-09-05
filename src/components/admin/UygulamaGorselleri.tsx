"use client";
import { useState } from "react";
import { r2Yukle } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import GorselPenceresi from "./GorselPenceresi";

/* ══════════════════════════════════════════════════════════════
   UYGULAMA TANITIM GÖRSELLERİ

   Simge · ekran görüntüleri (çoklu) · mağaza rozetleri
   ══════════════════════════════════════════════════════════════ */

const ROZETLER = [
  { alan: "app_store_badge_key",    ad: "App Store rozeti" },
  { alan: "play_store_badge_key",   ad: "Google Play rozeti" },
  { alan: "app_gallery_badge_key",  ad: "AppGallery rozeti" },
] as const;

export default function UygulamaGorselleri({
  simge, blokGorsel, ekranlar, rozetler, cdnBase, onDegisti,
}: {
  simge: string | null;
  /* Site tanıtım bloğundaki telefon görseli */
  blokGorsel?: string | null;
  ekranlar: string[];
  rozetler: Record<string, string | null>;
  cdnBase: string;
  onDegisti: (alan: string, deger: string | string[] | null) => void;
}) {
  const t = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  /* Açık görsel penceresi — null ise kapalı */
  const [gorselPencere, setGorselPencere] = useState<{
    alan: string; baslik: string; aciklama?: string; oran?: string;
  } | null>(null);

  const url = (k: string | null | undefined) =>
    k ? `${cdnBase.replace(/\/+$/, "")}/${k}` : null;

  async function yukle(file: File, etiket: string): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      t.error("Yalnızca görsel yüklenebilir"); return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      t.error("Dosya 5 MB'den büyük"); return null;
    }
    try {
      const { key } = await r2Yukle(file, "library", `${etiket}-${file.name}`);
      return key;
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Yüklenemedi");
      return null;
    }
  }

  async function tekliYukle(alan: string, file: File) {
    setBusy(alan);
    const key = await yukle(file, alan);
    setBusy(null);
    if (key) { onDegisti(alan, key); t.success("Yüklendi"); }
  }

  /*
   * ⚠ EKRAN GÖRÜNTÜLERİ SIRALI.
   *
   * Tanıtım kartında soldan sağa bu sırayla gösteriliyor.
   * Sıra karışırsa kullanıcıya anlamsız bir akış çıkıyor;
   * o yüzden diziye ekleme sona yapılıyor ve taşıma düğmeleri var.
   */
  async function ekranEkle(dosyalar: FileList) {
    setBusy("app_screenshots");
    const yeni: string[] = [];
    for (const f of Array.from(dosyalar)) {
      const key = await yukle(f, "app-ss");
      if (key) yeni.push(key);
    }
    setBusy(null);
    if (yeni.length) {
      onDegisti("app_screenshots", [...ekranlar, ...yeni]);
      t.success(`${yeni.length} görsel eklendi`);
    }
  }

  function ekranSil(i: number) {
    onDegisti("app_screenshots", ekranlar.filter((_, j) => j !== i));
  }

  function ekranTasi(i: number, yon: -1 | 1) {
    const j = i + yon;
    if (j < 0 || j >= ekranlar.length) return;
    const d = [...ekranlar];
    [d[i], d[j]] = [d[j], d[i]];
    onDegisti("app_screenshots", d);
  }

  const kutu =
    "flex h-[92px] w-[92px] shrink-0 items-center justify-center " +
    "overflow-hidden rounded-xl border border-line bg-surface2";

  return (
    <div className="mt-4 grid gap-5">
      {gorselPencere && (
        <GorselPenceresi
          acik
          onKapat={() => setGorselPencere(null)}
          baslik={gorselPencere.baslik}
          aciklama={gorselPencere.aciklama}
          oran={gorselPencere.oran}
          cdnBase={cdnBase}
          mevcut={
            gorselPencere.alan === "app_icon_key"
              ? simge
              : gorselPencere.alan === "app_promo_key"
              ? (blokGorsel ?? null)
              : rozetler[gorselPencere.alan] ?? null
          }
          onKaydet={(anahtar: string | null) => { onDegisti(gorselPencere.alan, anahtar); }}
        />
      )}
      {/* ---- simge ---- */}
      <div>
        <div className="mb-2 text-[12.5px] font-bold">Uygulama simgesi</div>
        <div className="flex items-center gap-3">
          <div className={kutu}>
            {url(simge) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url(simge)!} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] text-muted2">yok</span>
            )}
          </div>
          {/*
            ⚠ DOSYA SEÇER SEÇMEZ KAYDETMİYOR.
            Önce seçilen dosya anında yüklenip ayara yazılıyordu;
            yanlış dosya seçmek canlı siteyi değiştiriyordu.
            Pencerede önizleme var, `Kaydet` demeden uygulanmıyor.
          */}
          <button
            type="button"
            onClick={() => setGorselPencere({
              alan: "app_icon_key", baslik: "Uygulama simgesi",
              aciklama: "Kare, en az 512×512. Köşeleri yuvarlatmaya gerek yok.",
              oran: "1 / 1",
            })}
            className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold"
          >
            {simge ? "Değiştir" : "Görsel seç"}
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted2">
          Kare, en az 512×512. Köşeleri yuvarlatmaya gerek yok.
        </p>
      </div>

      {/* ---- site tanıtım bloğu görseli ---- */}
      <div>
        <div className="mb-2 text-[12.5px] font-bold">Tanıtım bloğu görseli</div>
        <p className="mb-2 text-[12px] leading-relaxed text-muted2">
          Ana sayfa ve haber sayfasındaki tanıtım bloğunda gösterilir.
          Telefon çerçeveli ekran görüntüsü önerilir; arka planı
          şeffaf PNG en iyi sonucu verir.
        </p>
        <div className="flex items-center gap-3">
          <div className={kutu}>
            {url(blokGorsel) ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url(blokGorsel)!} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[11px] text-muted2">yok</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setGorselPencere({
              alan: "app_promo_key", baslik: "Tanıtım bloğu görseli",
              aciklama: "Dikey telefon görseli. Şeffaf PNG önerilir; "
                + "blokta alta sıfır yaslanır.",
              oran: "9 / 16",
            })}
            className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold"
          >
            Değiştir
          </button>
        </div>
      </div>

      {/* ---- ekran görüntüleri ---- */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12.5px] font-bold">
            Ekran görüntüleri {ekranlar.length > 0 && `(${ekranlar.length})`}
          </span>
          <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold">
            {busy === "app_screenshots" ? "…" : "Görsel ekle"}
            <input
              type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void ekranEkle(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {ekranlar.length === 0 ? (
          <p className="text-[11.5px] text-muted2">
            Henüz görsel yok. Dikey (9:16) ekran görüntüleri en iyi sonucu veriyor.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {ekranlar.map((k, i) => (
              <div key={k + i} className="relative">
                <div className="h-[150px] w-[84px] overflow-hidden rounded-lg border border-line bg-surface2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url(k)!} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="mt-1.5 flex items-center justify-center gap-1">
                  <button
                    type="button" onClick={() => ekranTasi(i, -1)}
                    disabled={i === 0}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px] disabled:opacity-30"
                    aria-label="Sola taşı"
                  >←</button>
                  <button
                    type="button" onClick={() => ekranSil(i)}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px] text-danger"
                    aria-label="Sil"
                  >sil</button>
                  <button
                    type="button" onClick={() => ekranTasi(i, 1)}
                    disabled={i === ekranlar.length - 1}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px] disabled:opacity-30"
                    aria-label="Sağa taşı"
                  >→</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- mağaza rozetleri ---- */}
      <div>
        <div className="mb-2 text-[12.5px] font-bold">Mağaza rozetleri</div>
        <p className="mb-3 text-[11.5px] leading-relaxed text-muted2">
          Boş bırakırsan o mağazanın düğmesi yazıyla gösterilir.
          Resmi rozet görsellerini kullanman önerilir.
        </p>
        <div className="flex flex-wrap gap-4">
          {ROZETLER.map((r) => (
            <div key={r.alan}>
              <div className="flex h-[46px] w-[150px] items-center justify-center overflow-hidden rounded-lg border border-line bg-surface2">
                {url(rozetler[r.alan]) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url(rozetler[r.alan])!} alt="" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <span className="text-[11px] text-muted2">yok</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setGorselPencere({
                  alan: r.alan, baslik: r.ad,
                  aciklama: "Resmi mağaza rozetini kullanman önerilir.",
                  oran: "3 / 1",
                })}
                className="mt-1.5 block w-full text-center text-[11.5px] font-semibold underline"
              >
                {r.ad}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
