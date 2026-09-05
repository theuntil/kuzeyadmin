"use client";
import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Input, Skeleton } from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   KÜNYE SEÇİMİ — KAYNAK YA DA YAZAR

   ┌─ İKİSİ BİRDEN OLMAZ ⚠️ ───────────────────────────────────┐
   │ Ajanstan gelen haberin kaynağı var, yazarı yok. Kendi      │
   │ muhabirimizin haberinin yazarı var, ajans kaynağı yok.     │
   │                                                              │
   │ Tek seçici: kaynak seçilince yazar temizleniyor, yazar     │
   │ seçilince kaynak. İki alan ayrı dursaydı ikisi birden      │
   │ doldurulabilir ve künyede hangisinin çıkacağı belirsiz     │
   │ kalırdı.                                                     │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface Kaynak {
  id: string; ad: string; tam_ad: string; slug: string;
  logo: string | null; logo_koyu: string | null; ajans: boolean;
}
export interface Yazar {
  id: string; ad: string; username: string | null;
  avatar: string | null; unvan: string | null; rol: string;
}

export default function KunyeSec({
  kaynakId, yazarId, onSec, cdn,
}: {
  kaynakId: string;
  yazarId: string;
  /** Biri dolu, diğeri boş gelir */
  onSec: (v: { source_id: string; author_id: string }) => void;
  cdn: string;
}) {
  const sb = supabaseBrowser();
  const [acik, setAcik] = useState(false);
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([]);
  const [yazarlar, setYazarlar] = useState<Yazar[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [arama, setArama] = useState("");
  const [sekme, setSekme] = useState<"kaynak" | "yazar">("kaynak");

  useEffect(() => {
    if (!acik || kaynaklar.length > 0 || yazarlar.length > 0) return;
    setYukleniyor(true);
    void (async () => {
      const { data } = await sb.rpc("admin_kunye_liste");
      const o = data as { kaynaklar?: Kaynak[]; yazarlar?: Yazar[] } | null;
      setKaynaklar(o?.kaynaklar ?? []);
      setYazarlar(o?.yazarlar ?? []);
      setYukleniyor(false);
    })();
  }, [acik, kaynaklar.length, yazarlar.length, sb]);

  const seciliKaynak = kaynaklar.find((k) => k.id === kaynakId);
  const seciliYazar = yazarlar.find((y) => y.id === yazarId);

  /* Seçili olanı bilmek için liste gerekmiyor — kapalıyken de çek */
  useEffect(() => {
    if (kaynaklar.length > 0 || yazarlar.length > 0) return;
    if (!kaynakId && !yazarId) return;
    void (async () => {
      const { data } = await sb.rpc("admin_kunye_liste");
      const o = data as { kaynaklar?: Kaynak[]; yazarlar?: Yazar[] } | null;
      setKaynaklar(o?.kaynaklar ?? []);
      setYazarlar(o?.yazarlar ?? []);
    })();
  }, [kaynakId, yazarId, kaynaklar.length, yazarlar.length, sb]);

  const q = arama.trim().toLocaleLowerCase("tr");
  const suzKaynak = useMemo(
    () => kaynaklar.filter((k) =>
      !q || k.ad.toLocaleLowerCase("tr").includes(q)
        || k.tam_ad.toLocaleLowerCase("tr").includes(q)),
    [kaynaklar, q]);
  const suzYazar = useMemo(
    () => yazarlar.filter((y) =>
      !q || y.ad.toLocaleLowerCase("tr").includes(q)
        || (y.username ?? "").includes(q)),
    [yazarlar, q]);

  const gorsel = (k: string | null) => (k ? `${cdn.replace(/\/+$/, "")}/${k}` : null);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="flex w-full items-center gap-2.5 rounded-[12px] border border-line2 bg-surface px-3 py-2.5 text-start transition-colors hover:border-line"
      >
        {seciliYazar ? (
          <>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-chip text-[11px] font-bold text-muted">
              {gorsel(seciliYazar.avatar) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={gorsel(seciliYazar.avatar)!} alt=""
                  className="h-full w-full object-cover" />
              ) : seciliYazar.ad.charAt(0).toLocaleUpperCase("tr")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{seciliYazar.ad}</span>
              <span className="block text-[11px] text-muted2">Yazar</span>
            </span>
          </>
        ) : seciliKaynak ? (
          <>
            <span className="flex h-7 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-white p-0.5">
              {gorsel(seciliKaynak.logo) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={gorsel(seciliKaynak.logo)!} alt=""
                  className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] font-bold text-black/50">
                  {seciliKaynak.ad.slice(0, 3)}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{seciliKaynak.ad}</span>
              <span className="block text-[11px] text-muted2">
                {seciliKaynak.ajans ? "Ajans" : "Kaynak"}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-[13.5px] text-muted2">Kaynak ya da yazar seç</span>
        )}
        <Icon name="chevronRight" size={15} />
      </button>

      <Modal open={acik} onClose={() => setAcik(false)} title="Künye">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5">
            {([["kaynak", "Kaynaklar"], ["yazar", "Yazarlarımız"]] as const).map(([k, ad]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSekme(k)}
                className={`flex-1 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                  sekme === k ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
                }`}
              >
                {ad}
              </button>
            ))}
          </div>

          <Input value={arama} onChange={(e) => setArama(e.target.value)}
            placeholder="Ara…" autoFocus />

          {yukleniyor ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="max-h-[52vh] overflow-y-auto">
              {sekme === "kaynak" ? (
                <ul className="flex flex-col gap-1">
                  {suzKaynak.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        onClick={() => {
                          /* ⚠ Kaynak seçilince yazar temizleniyor */
                          onSec({ source_id: k.id, author_id: "" });
                          setAcik(false); setArama("");
                        }}
                        className={`flex w-full items-center gap-3 rounded-[12px] p-2.5 text-start transition-colors ${
                          k.id === kaynakId ? "bg-solid text-on-solid" : "hover:bg-chip"
                        }`}
                      >
                        <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white p-1">
                          {gorsel(k.logo) ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={gorsel(k.logo)!} alt=""
                              className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[10px] font-bold text-black/50">
                              {k.ad.slice(0, 4)}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">{k.ad}</span>
                          <span className={`block truncate text-[11.5px] ${
                            k.id === kaynakId ? "opacity-80" : "text-muted2"
                          }`}>
                            {k.tam_ad}
                          </span>
                        </span>
                        {k.id === kaynakId && <Icon name="check" size={16} />}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="flex flex-col gap-1">
                  {suzYazar.map((y) => (
                    <li key={y.id}>
                      <button
                        type="button"
                        onClick={() => {
                          /* ⚠ Yazar seçilince kaynak temizleniyor */
                          onSec({ source_id: "", author_id: y.id });
                          setAcik(false); setArama("");
                        }}
                        className={`flex w-full items-center gap-3 rounded-[12px] p-2.5 text-start transition-colors ${
                          y.id === yazarId ? "bg-solid text-on-solid" : "hover:bg-chip"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-chip text-[12px] font-bold text-muted">
                          {gorsel(y.avatar) ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={gorsel(y.avatar)!} alt=""
                              className="h-full w-full object-cover" />
                          ) : y.ad.charAt(0).toLocaleUpperCase("tr")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold">{y.ad}</span>
                          <span className={`block truncate text-[11.5px] ${
                            y.id === yazarId ? "opacity-80" : "text-muted2"
                          }`}>
                            {y.unvan ?? (y.username ? `@${y.username}` : y.rol)}
                          </span>
                        </span>
                        {y.id === yazarId && <Icon name="check" size={16} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {((sekme === "kaynak" && suzKaynak.length === 0)
                || (sekme === "yazar" && suzYazar.length === 0)) && (
                <p className="py-8 text-center text-[13.5px] text-muted">Sonuç yok.</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
