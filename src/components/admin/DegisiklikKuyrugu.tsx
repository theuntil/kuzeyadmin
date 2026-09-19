"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   ONAY BEKLEYEN DEĞİŞİKLİKLER

   ┌─ YAYINDAKİ SÜRÜM DOKUNULMUYOR ⚠️ ──────────────────────────┐
   │ Yayın yetkisi olmayan bir yazar yayındaki haberi           │
   │ düzenlediğinde değişiklik ayrı bir taslakta bekliyor;      │
   │ okurun gördüğü sürüm değişmiyor.                            │
   │                                                              │
   │ Burada iki sürüm yan yana gösteriliyor: onaylarsan taslak  │
   │ yayına geçiyor, reddedersen taslak siliniyor ve yayındaki  │
   │ sürüm olduğu gibi kalıyor.                                   │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Degisiklik {
  id: string;
  slug: string;
  yayindaki_baslik: string;   yeni_baslik: string | null;
  yayindaki_ozet: string | null;   yeni_ozet: string | null;
  yayindaki_kapak: string | null;  yeni_kapak: string | null;
  yayindaki_etiket: string[] | null; yeni_etiket: string[] | null;
  yayindaki_kategori: string | null; yeni_kategori: string | null;
  yayindaki_sehir: string | null;    yeni_sehir: string | null;
  yayindaki_metin: string | null;    yeni_metin: string | null;
  yayindaki_uzunluk: number;         yeni_uzunluk: number;
  medya_degisti: boolean;
  yayindaki_medya_adet: number;      yeni_medya_adet: number;
  yazar: string;
  yazar_id: string | null;
  gonderim: string;
}

export default function DegisiklikKuyrugu({
  yazarId,
}: {
  /*
   * Verilirse yalnızca o yazarın değişiklikleri gösteriliyor.
   * Onay sayfasında boş bırakılıyor: hepsi listeleniyor.
   */
  yazarId?: string;
} = {}) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [liste, setListe] = useState<Degisiklik[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_degisiklik_bekleyenler");
    setYukleniyor(false);
    if (error) { t.error("Okunamadı: " + error.message); return; }
    const hepsi = (data ?? []) as Degisiklik[];
    setListe(yazarId ? hepsi.filter((x) => x.yazar_id === yazarId) : hepsi);
  }, [sb, t, yazarId]);

  useEffect(() => { void yukle(); }, [yukle]);

  async function karar(d: Degisiklik, onay: boolean) {
    if (islem) return;
    setIslem(d.id);

    const { error } = await sb.rpc("admin_degisiklik_karar", {
      p_id: d.id, p_onay: onay,
    });
    setIslem(null);

    if (error) { t.error(error.message); return; }
    t.success(onay ? "Değişiklik yayına alındı" : "Değişiklik reddedildi");
    await yukle();
  }

  if (yukleniyor) {
    return (
      <div className="grid gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface2" />
        ))}
      </div>
    );
  }

  if (liste.length === 0) {
    return (
      <p className="py-10 text-center text-[13.5px] text-muted2">
        Onay bekleyen değişiklik yok.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {liste.map((d) => {
        const baslikDegisti = d.yeni_baslik && d.yeni_baslik !== d.yayindaki_baslik;
        const ozetDegisti = d.yeni_ozet && d.yeni_ozet !== d.yayindaki_ozet;
        const kapakDegisti = Boolean(d.yeni_kapak)
          && d.yeni_kapak !== d.yayindaki_kapak;
        const kategoriDegisti = Boolean(d.yeni_kategori)
          && d.yeni_kategori !== d.yayindaki_kategori;
        const sehirDegisti = Boolean(d.yeni_sehir)
          && d.yeni_sehir !== d.yayindaki_sehir;
        const metinDegisti = Boolean(d.yeni_metin)
          && d.yeni_metin !== d.yayindaki_metin;
        const etiketDegisti =
          JSON.stringify(d.yeni_etiket ?? []) !==
          JSON.stringify(d.yayindaki_etiket ?? []);

        return (
          <div key={d.id} className="rounded-2xl border border-line p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-muted2">
              <span className="font-semibold text-ink">{d.yazar}</span>
              <span>değişiklik gönderdi</span>
              <span>· {new Date(d.gonderim).toLocaleString("tr-TR")}</span>
            </div>

            {/*
              ⚠ YALNIZCA DEĞİŞEN ALANLAR.
              Her alanı her seferinde basmak kartı uzatıyor ve
              asıl farkı gözden kaçırtıyordu. Değişmeyen alan
              hiç gösterilmiyor.
            */}
            <div className="grid gap-2.5">
              {baslikDegisti && (
                <Alan
                  ad="Başlık"
                  eski={d.yayindaki_baslik}
                  yeni={d.yeni_baslik}
                />
              )}

              {ozetDegisti && (
                <Alan ad="Özet" eski={d.yayindaki_ozet} yeni={d.yeni_ozet} />
              )}

              {kategoriDegisti && (
                <Alan
                  ad="Kategori"
                  eski={d.yayindaki_kategori}
                  yeni={d.yeni_kategori}
                />
              )}

              {sehirDegisti && (
                <Alan ad="Şehir" eski={d.yayindaki_sehir} yeni={d.yeni_sehir} />
              )}

              {metinDegisti && (
                <Alan
                  ad={`Metin (${d.yayindaki_uzunluk} → ${d.yeni_uzunluk} karakter)`}
                  eski={d.yayindaki_metin}
                  yeni={d.yeni_metin}
                  uzun
                />
              )}

              {etiketDegisti && (
                <div className="rounded-xl border border-line p-3">
                  <div className="mb-2 text-[11.5px] font-bold text-muted2">
                    ETİKETLER
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Etiketler baslik="Yayındaki" liste={d.yayindaki_etiket} />
                    <Etiketler baslik="Önerilen" liste={d.yeni_etiket} vurgu />
                  </div>
                </div>
              )}

              {kapakDegisti && (
                <div className="rounded-xl border border-line p-3">
                  <div className="mb-2 text-[11.5px] font-bold text-muted2">
                    KAPAK GÖRSELİ
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Kapak baslik="Yayındaki" src={d.yayindaki_kapak} />
                    <Kapak baslik="Önerilen" src={d.yeni_kapak} vurgu />
                  </div>
                </div>
              )}

              {d.medya_degisti && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-[12.5px]">
                  <Icon name="media" size={15} />
                  <span>
                    Haber içi medya değişti:{" "}
                    <strong>
                      {d.yayindaki_medya_adet} → {d.yeni_medya_adet} öğe
                    </strong>
                    {/*
                      ⚠ İÇERİK GÖSTERİLMİYOR.
                      Medya listesi uzun bir JSON; kartta basmak
                      karşılaştırmayı okunmaz yapardı. Ayrıntı
                      için haber açılıyor.
                    */}
                  </span>
                </div>
              )}

              {!baslikDegisti && !ozetDegisti && !kategoriDegisti
                && !sehirDegisti && !metinDegisti && !etiketDegisti
                && !kapakDegisti && !d.medya_degisti && (
                <p className="rounded-xl border border-line p-3 text-[12.5px] text-muted2">
                  Görünür bir fark yok — yazar kaydetti ama içerik
                  değişmemiş olabilir.
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/haberler/${d.id}`}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold"
              >
                <Icon name="edit" size={14} /> Haberi aç
              </Link>

              <span className="flex-1" />

              <button
                type="button"
                onClick={() => void karar(d, false)}
                disabled={islem === d.id}
                className="rounded-lg border border-red-500/40 px-3.5 py-2 text-[12.5px] font-semibold text-red-500 disabled:opacity-40"
              >
                Reddet
              </button>
              <button
                type="button"
                onClick={() => void karar(d, true)}
                disabled={islem === d.id}
                className="rounded-lg bg-ink px-4 py-2 text-[12.5px] font-bold text-bg disabled:opacity-40"
              >
                {islem === d.id ? "…" : "Onayla"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   KARŞILAŞTIRMA PARÇALARI

   ⚠ HEPSİ AYNI DÜZENDE.
   Solda yayındaki, sağda önerilen. Farklı alanlar farklı
   biçimde gösterilseydi göz her seferinde yeniden yer arardı.
   ══════════════════════════════════════════════════════════════ */

function Alan({
  ad, eski, yeni, uzun = false,
}: {
  ad: string;
  eski: string | null;
  yeni: string | null;
  /** Metin gövdesi gibi uzun içerikler için daha fazla satır */
  uzun?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 text-[11.5px] font-bold uppercase text-muted2">
        {ad}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-chip p-2.5">
          <div className="mb-1 text-[10.5px] font-bold text-muted2">
            YAYINDAKİ
          </div>
          <p
            className={`text-[12.5px] leading-relaxed ${
              uzun ? "line-clamp-6" : ""
            }`}
          >
            {eski || <span className="text-muted2">—</span>}
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
          <div className="mb-1 text-[10.5px] font-bold text-amber-500">
            ÖNERİLEN
          </div>
          <p
            className={`text-[12.5px] leading-relaxed ${
              uzun ? "line-clamp-6" : ""
            }`}
          >
            {yeni || <span className="text-muted2">—</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function Etiketler({
  baslik, liste, vurgu = false,
}: { baslik: string; liste: string[] | null; vurgu?: boolean }) {
  return (
    <div
      className={`rounded-lg p-2.5 ${
        vurgu ? "border border-amber-500/40 bg-amber-500/5" : "bg-chip"
      }`}
    >
      <div
        className={`mb-1.5 text-[10.5px] font-bold ${
          vurgu ? "text-amber-500" : "text-muted2"
        }`}
      >
        {baslik.toLocaleUpperCase("tr")}
      </div>
      {(liste?.length ?? 0) === 0 ? (
        <span className="text-[12px] text-muted2">etiket yok</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {liste!.map((e) => (
            <span
              key={e}
              className="rounded-full bg-surface px-2 py-0.5 text-[11px]"
            >
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Kapak({
  baslik, src, vurgu = false,
}: { baslik: string; src: string | null; vurgu?: boolean }) {
  return (
    <div
      className={`rounded-lg p-2.5 ${
        vurgu ? "border border-amber-500/40 bg-amber-500/5" : "bg-chip"
      }`}
    >
      <div
        className={`mb-1.5 text-[10.5px] font-bold ${
          vurgu ? "text-amber-500" : "text-muted2"
        }`}
      >
        {baslik.toLocaleUpperCase("tr")}
      </div>
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          loading="lazy"
          className="aspect-[16/9] w-full rounded-md object-cover"
        />
      ) : (
        <div className="grid aspect-[16/9] w-full place-items-center rounded-md bg-surface text-[11.5px] text-muted2">
          kapak yok
        </div>
      )}
    </div>
  );
}
