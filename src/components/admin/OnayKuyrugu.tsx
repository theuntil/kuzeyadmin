"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { kapakAdresi, type KapakBilgi } from "@/lib/medya-adres";
import { d } from "@/lib/utils";
import { Badge, Button, EmptyState } from "@/components/ui";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   ONAY KUYRUĞU

   Yazarların gönderdiği, henüz yayınlanmamış haberler.

   ┌─ NEDEN RPC, GÖRÜNÜM DEĞİL ⚠️ ─────────────────────────────┐
   │ Önce `admin_articles` görünümü doğrudan sorgulanıyordu ve  │
   │ sayfa hep BOŞ geliyordu.                                    │
   │                                                              │
   │ O görünüm `security_invoker=true` ile tanımlı, yani RLS      │
   │ çağıranın yetkisiyle işliyor. `articles` üzerindeki okuma   │
   │ politikası `is_staff()` istiyor ve `is_staff()` yalnızca    │
   │ admin için doğru — editör rolündeki kullanıcı bekleyen      │
   │ haberleri hiç göremiyordu.                                   │
   │                                                              │
   │ `admin_haber_liste` SECURITY DEFINER ve panelin Haberler    │
   │ sayfası zaten onu kullanıyor. Kanıtlanmış yol tercih edildi.│
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface KuyrukSatir {
  id: string; slug: string; title: string; summary: string | null;
  status: string; created_at: string; published_at: string | null;
  kapak: KapakBilgi | null;
  kategori: string | null; sehir: string | null;
  yazar: string | null; son_dakika: boolean;
  onem_puani: number | null;
}

export default function OnayKuyrugu({
  cdn, siteUrl, canApprove,
}: {
  cdn: string;
  siteUrl: string;
  canApprove: boolean;
}) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [satirlar, setSatirlar] = useState<KuyrukSatir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<string | null>(null);
  const [sekme, setSekme] = useState<"pending_review" | "rejected">("pending_review");

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_haber_liste", {
      p: { limit: 100, offset: 0, status: sekme },
    });
    setYukleniyor(false);

    if (error) { t.error("Liste okunamadı: " + error.message); return; }
    const o = data as { satirlar: KuyrukSatir[] } | null;
    setSatirlar(o?.satirlar ?? []);
  }, [sb, t, sekme]);

  useEffect(() => { void yukle(); }, [yukle]);

  async function karar(id: string, onay: boolean) {
    setIslem(id);

    /*
     * ⚠ PARAMETRE ADI `p_article_id`.
     * PostgREST fonksiyonları argüman ADINA göre eşliyor;
     * `p_id` göndermek "function not found" veriyor.
     */
    const { error } = onay
      ? await sb.rpc("approve_article", { p_article_id: id })
      : await sb.rpc("reject_article", { p_article_id: id, p_note: null });

    setIslem(null);
    if (error) { t.error(error.message); return; }

    t.success(onay ? "Haber yayınlandı" : "Haber reddedildi");
    /* Listeden anında kalkıyor — yeniden çekmeye gerek yok */
    setSatirlar((p) => p.filter((x) => x.id !== id));
  }

  const sekmeler = [
    { k: "pending_review" as const, ad: "Onay bekleyen" },
    { k: "rejected" as const, ad: "Reddedilen" },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        {sekmeler.map((x) => (
          <button
            key={x.k}
            type="button"
            onClick={() => setSekme(x.k)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              sekme === x.k
                ? "bg-fg text-bg"
                : "border border-line text-muted hover:text-fg"
            }`}
          >
            {x.ad}
          </button>
        ))}
      </div>

      {yukleniyor ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
      ) : satirlar.length === 0 ? (
        <EmptyState
          title={sekme === "pending_review" ? "Onay bekleyen haber yok" : "Reddedilen haber yok"}
          description={
            sekme === "pending_review"
              ? "Yazarlar haber gönderdiğinde burada listelenir."
              : "Reddettiğin haberler burada durur. Yazar düzenleyip tekrar gönderebilir."
          }
        />
      ) : (
        <div className="grid gap-3">
          {satirlar.map((h) => {
            const gorsel = kapakAdresi(h.kapak, cdn, "thumb");
            const mesgul = islem === h.id;

            return (
              <article
                key={h.id}
                className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4"
              >
                {/* Kapak — yoksa yer kaplamıyor */}
                {gorsel && (
                  <Link
                    href={`/haberler/${h.id}`}
                    className="block h-[76px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-surface2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gorsel} alt="" className="h-full w-full object-cover" />
                  </Link>
                )}

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    {h.status === "pending_review" ? (
                      <Badge tone="accent">Onay bekliyor</Badge>
                    ) : (
                      <Badge tone="danger">Reddedildi</Badge>
                    )}
                    {h.son_dakika && <Badge tone="danger">Son dakika</Badge>}
                    {typeof h.onem_puani === "number" && h.onem_puani >= 8 && (
                      <Badge tone="accent">Önem {h.onem_puani}</Badge>
                    )}
                  </div>

                  <Link
                    href={`/haberler/${h.id}`}
                    className="block truncate text-[15px] font-bold leading-snug hover:underline"
                  >
                    {h.title}
                  </Link>

                  <div className="mt-1 truncate text-[12.5px] text-muted2">
                    {[h.yazar, h.kategori, h.sehir, d(h.created_at)]
                      .filter(Boolean).join(" · ")}
                  </div>
                </div>

                {/* İşlem düğmeleri — kartın sonunda */}
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/haberler/${h.id}`}
                    className="rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold"
                  >
                    İncele
                  </Link>

                  {canApprove && (
                    <>
                      {h.status === "rejected" ? null : (
                        <Button
                          variant="ghost"
                          onClick={() => void karar(h.id, false)}
                          disabled={mesgul}
                        >
                          Reddet
                        </Button>
                      )}
                      <Button
                        onClick={() => void karar(h.id, true)}
                        disabled={mesgul}
                      >
                        {mesgul ? "…" : "Onayla"}
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {siteUrl ? null : null}
    </div>
  );
}
