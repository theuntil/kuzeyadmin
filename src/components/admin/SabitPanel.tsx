"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import Icon from "@/components/ui/Icon";
import { kapakAdresi, type KapakBilgi } from "@/lib/medya-adres";

/* ══════════════════════════════════════════════════════════════
   VİTRİNE SABİTLENEN HABERLER

   Seçilen haberler ana sayfanın en üstündeki kaydırılabilir
   vitrinde her zaman ilk sıralarda duruyor.

   ┌─ SABİTLEME KALICI DEĞİL, TERSİNE ÇEVRİLEBİLİR ⚠️ ──────────┐
   │ "Kaldır" denince haber normal akışa dönüyor — silinmiyor,  │
   │ yayından kalkmıyor. Yalnızca öne çıkarma bitiyor.          │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Sabit {
  id: string;
  slug: string;
  baslik: string;
  kapak: string | null;
  sira: number;
  yayinda: boolean;
}

/*
 * ⚠ ALAN ADLARI `admin_haber_liste` İLE AYNI.
 * O fonksiyon başlığı `title` olarak döndürüyor; `baslik`
 * beklemek boş kart basmak demekti.
 */
/*
 * ┌─ KAPAK ADRESİ BASİT DEĞİL ⚠️ ──────────────────────────────┐
 * │ Önce `cdn + storage_key` diye kurmuştum. Panelden          │
 * │ yüklenen görsellerde bu doğru ama AJANS görsellerinde      │
 * │ dosya varyantlara ayrılmış:                                  │
 * │     .../1932414-card.webp                                    │
 * │ Varyant eki olmadan istenince 404 dönüyordu.                │
 * │                                                              │
 * │ Projede bu işi doğru yapan `kapakAdresi` zaten var;         │
 * │ kendi basit sürümümü yazmak yerine o kullanılıyor.          │
 * └──────────────────────────────────────────────────────────────┘
 */
interface Aday {
  id: string;
  slug: string;
  title: string;
  kapak: KapakBilgi | null;
}

export default function SabitPanel({ cdnBase }: { cdnBase: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [liste, setListe] = useState<Sabit[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [adaylar, setAdaylar] = useState<Aday[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_sabit_liste");
    setYukleniyor(false);
    if (error) { t.error("Liste okunamadı: " + error.message); return; }
    setListe((data ?? []) as Sabit[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  /*
   * ⚠ HER TUŞTA SORGU ATILMIYOR.
   * Yazarken her karakterde istek göndermek hem sunucuyu hem
   * bağlantıyı gereksiz meşgul ederdi. Yazma durunca aranıyor.
   */
  useEffect(() => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);

    const terim = q.trim();
    if (terim.length < 2) { setAdaylar([]); return; }

    zamanlayici.current = setTimeout(() => {
      void (async () => {
        setAraniyor(true);
        const { data, error } = await sb.rpc("admin_haber_liste", {
          p: { limit: 8, offset: 0, q: terim, status: "published" },
        });
        setAraniyor(false);

        if (error) { t.error(error.message); return; }

        const o = data as { satirlar?: Aday[] } | null;
        setAdaylar((o?.satirlar ?? []) as Aday[]);
      })();
    }, 350);

    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    };
  }, [q, sb, t]);

  async function sabitle(a: Aday) {
    if (liste.some((x) => x.id === a.id)) {
      t.error("Bu haber zaten sabit");
      return;
    }

    setIslem(a.id);
    /* Yeni sabit listenin sonuna ekleniyor */
    const sonraki = liste.length === 0
      ? 0
      : Math.max(...liste.map((x) => x.sira)) + 1;

    const { error } = await sb.rpc("admin_sabit_ayarla", {
      p_id: a.id, p_sira: sonraki,
    });
    setIslem(null);

    if (error) { t.error(error.message); return; }
    t.success("Vitrine sabitlendi");
    setQ("");
    setAdaylar([]);
    await yukle();
  }

  async function kaldir(s: Sabit) {
    setIslem(s.id);
    const { error } = await sb.rpc("admin_sabit_ayarla", {
      p_id: s.id, p_sira: null,
    });
    setIslem(null);

    if (error) { t.error(error.message); return; }
    t.success("Sabitleme kaldırıldı");
    await yukle();
  }

  /**
   * Sırayı bir basamak değiştirir.
   *
   * ⚠ İKİ KAYIT BİRDEN GÜNCELLENİYOR.
   * Yalnızca birinin sırasını değiştirmek çakışma yaratır;
   * ikisi yer değiştiriyor.
   */
  async function tasi(s: Sabit, yon: -1 | 1) {
    const i = liste.findIndex((x) => x.id === s.id);
    const hedef = liste[i + yon];
    if (!hedef) return;

    setIslem(s.id);
    await Promise.all([
      sb.rpc("admin_sabit_ayarla", { p_id: s.id, p_sira: hedef.sira }),
      sb.rpc("admin_sabit_ayarla", { p_id: hedef.id, p_sira: s.sira }),
    ]);
    setIslem(null);
    await yukle();
  }

  return (
    <div className="grid gap-5">
      {/* ---- arama ---- */}
      <div className="rounded-2xl border border-line p-5">
        {/*
          ⚠ AÇIKLAMA KISALTILDI.
          Üç satırlık bilgilendirme her açılışta okunuyordu ama
          bir kez öğrenildikten sonra yalnızca yer kaplıyordu.
          Sayfa başlığı zaten ne olduğunu söylüyor.
        */}
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Haber başlığında ara…"
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
          />

          {araniyor && (
            <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[12px] text-muted2">
              aranıyor…
            </span>
          )}
        </div>

        {adaylar.length > 0 && (
          <div className="mt-3 grid gap-2">
            {adaylar.map((a) => {
              const zaten = liste.some((x) => x.id === a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void sabitle(a)}
                  disabled={zaten || islem === a.id}
                  className="flex items-center gap-3 rounded-xl border border-line p-2.5 text-start transition-colors hover:border-ink/25 disabled:opacity-45"
                >
                  <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-chip">
                    {kapakAdresi(a.kapak, cdn, "thumb") && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={kapakAdresi(a.kapak, cdn, "thumb")!}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {a.title}
                  </span>

                  <span className="shrink-0 text-[11.5px] font-bold text-muted2">
                    {zaten ? "zaten sabit" : "Sabitle"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {q.trim().length >= 2 && !araniyor && adaylar.length === 0 && (
          <p className="mt-3 text-[12.5px] text-muted2">Sonuç yok.</p>
        )}
      </div>

      {/* ---- sabitler ---- */}
      <div className="rounded-2xl border border-line p-5">
        <div className="mb-4 text-[13px] font-bold">Sabitlenenler</div>

        {yukleniyor ? (
          <div className="grid gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface2" />
            ))}
          </div>
        ) : liste.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-muted2">
            Sabitlenmiş haber yok.
          </p>
        ) : (
          <div className="grid gap-2">
            {liste.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-line p-2.5"
              >
                <span className="kb-num w-5 shrink-0 text-center text-[13px] font-bold text-muted2">
                  {i + 1}
                </span>

                <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-chip">
                  {s.kapak && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={s.kapak}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {s.baslik}
                  </span>
                  {!s.yayinda && (
                    /*
                     * ⚠ YAYINDA OLMAYAN SABİT UYARILIYOR.
                     * Taslağa alınmış bir haber sabit kalırsa
                     * vitrinde hiç görünmez; yönetici sebebini
                     * anlamadan beklerdi.
                     */
                    <span className="text-[11.5px] font-semibold text-amber-500">
                      yayında değil
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => void tasi(s, -1)}
                  disabled={i === 0 || islem === s.id}
                  aria-label="Yukarı taşı"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line disabled:opacity-30"
                >
                  <span className="-rotate-90">
                    <Icon name="chevronLeft" size={13} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void tasi(s, 1)}
                  disabled={i === liste.length - 1 || islem === s.id}
                  aria-label="Aşağı taşı"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line disabled:opacity-30"
                >
                  <span className="rotate-90">
                    <Icon name="chevronRight" size={13} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void kaldir(s)}
                  disabled={islem === s.id}
                  aria-label="Sabitlemeyi kaldır"
                  title="Sabitlemeyi kaldır"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-muted2 disabled:opacity-30"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
