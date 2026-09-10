"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   BEKLEYEN İŞLER

   Onay bekleyen yeni haberler ile yayındaki haberlerde bekleyen
   değişiklikler tek listede.

   ⚠ BEKLEYEN YOKSA HİÇ BASILMIYOR.
   Boş bir "Bekleyen işler" kartı her gün karşına çıkıp yer
   kaplardı. Kart yalnızca gerçekten iş varken beliriyor.
   ══════════════════════════════════════════════════════════════ */

interface Bekleyen {
  id: string;
  slug: string;
  baslik: string;
  kapak: string | null;
  yazar: string;
  avatar: string | null;
  tur: "yeni" | "degisiklik";
  tarih: string;
}

export default function BekleyenWidget({ cdnBase }: { cdnBase: string }) {
  const [liste, setListe] = useState<Bekleyen[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const cdn = cdnBase.replace(/\/+$/, "");

  const getir = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("admin_bekleyen_ozet", { p_limit: 5 });
    setYukleniyor(false);

    if (error) {
      /* Bekleyen işler kartı sayfanın olmazsa olmazı değil */
      console.error("[BEKLEYEN] okunamadı:", error.message);
      return;
    }
    setListe((data ?? []) as Bekleyen[]);
  }, []);

  useEffect(() => { void getir(); }, [getir]);

  if (yukleniyor) {
    return <div className="h-[168px] animate-pulse rounded-2xl bg-surface2" />;
  }

  if (liste.length === 0) return null;

  /*
   * Avatar anahtarı R2'de; tam adres burada kuruluyor.
   * Zaten tam adresse (dış bağlantı) olduğu gibi kalıyor.
   */
  const adres = (k: string | null) =>
    !k ? null : /^https?:\/\//i.test(k) ? k : `${cdn}/${k}`;

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[.04] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-500">
            <Icon name="warn" size={15} />
          </span>
          <span className="text-[13px] font-bold">
            Bekleyen işler
            <span className="ms-1.5 font-normal text-muted2">
              ({liste.length})
            </span>
          </span>
        </div>

        <Link
          href="/onay"
          className="text-[12.5px] font-semibold text-muted2 hover:text-ink"
        >
          Tümü
        </Link>
      </div>

      <div className="grid gap-2">
        {liste.map((b) => (
          <Link
            key={`${b.tur}-${b.id}`}
            /*
             * ⚠ İKİ TÜR AYNI SAYFAYA GİDİYOR.
             * Onay ekranında hem yeni haberler hem değişiklikler
             * var; ayrı adreslere göndermek gereksiz bölünme
             * olurdu.
             */
            href="/onay"
            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-ink/25"
          >
            <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-chip">
              {adres(b.kapak) && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={adres(b.kapak)!}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">
                {b.baslik}
              </span>

              <span className="mt-1 flex items-center gap-1.5">
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center overflow-hidden rounded-full bg-chip text-[9px] font-bold text-muted2">
                  {adres(b.avatar) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={adres(b.avatar)!}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    b.yazar.charAt(0).toLocaleUpperCase("tr")
                  )}
                </span>
                <span className="truncate text-[11.5px] text-muted2">
                  {b.yazar}
                </span>
              </span>
            </span>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                b.tur === "yeni"
                  ? "bg-chip text-muted2"
                  : "bg-amber-500/15 text-amber-500"
              }`}
            >
              {b.tur === "yeni" ? "Yeni haber" : "Değişiklik"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
