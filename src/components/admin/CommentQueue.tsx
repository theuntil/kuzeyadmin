"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Tabs, Input, Badge, EmptyState, Skeleton,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   YORUMLAR

   ┌─ VARSAYILAN: TÜM YORUMLAR ⚠️ ─────────────────────────────┐
   │ Önce yalnızca onay bekleyenler listeleniyordu. Yayınlanmış │
   │ bir yorumu silmek için SQL gerekiyordu — oysa moderasyonun │
   │ asıl işi zaten yayındaki içeriği izlemek.                   │
   │                                                              │
   │ İki sekme: Yorumlar (hepsi, varsayılan) ve Onay bekleyen.  │
   └──────────────────────────────────────────────────────────────┘

   Yazarın avatarına tıklayınca kullanıcı detayına gidiliyor —
   "bu kişi başka ne yazmış" sorusu bir tıkla cevaplanıyor.
   ══════════════════════════════════════════════════════════════ */

export interface Yorum {
  id: string;
  body: string;
  status: string;
  report_count: number;
  created_at: string;
  article_id: string;
  haber: string;
  haber_slug: string;
  user_id: string | null;
  yazar: string;
  yazar_kullanici: string | null;
  yazar_avatar: string | null;
  yazar_harf: string;
  denetleyen: string;
}

const DURUM: Record<string, { l: string; t: "green" | "orange" | "danger" | "muted" }> = {
  approved: { l: "Onaylı", t: "green" },
  pending: { l: "Bekliyor", t: "orange" },
  rejected: { l: "Reddedildi", t: "danger" },
  spam: { l: "Spam", t: "danger" },
  deleted: { l: "Silinmiş", t: "muted" },
};

/** Aynı kişi her zaman aynı rengi alsın */
function ton(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

const SAYFA_BOYU = 30;

export default function CommentQueue({
  initial, cdnBase, siteUrl,
}: {
  initial: Yorum[];
  cdnBase: string;
  siteUrl: string;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");
  const site = siteUrl.replace(/\/+$/, "");

  const [liste, setListe] = useState<Yorum[]>(initial);
  const [sekme, setSekme] = useState<"hepsi" | "bekleyen">("hepsi");
  const [arama, setArama] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [silinecek, setSilinecek] = useState<Yorum | null>(null);
  /*
   * ⚠ SAYFALAMA ŞART.
   * Tüm yorumlar tek seferde çekiliyordu; 1000+ yorumda hem
   * sorgu yavaşlıyor hem tarayıcı donuyordu.
   */
  const [sayfa, setSayfa] = useState(0);
  const [toplam, setToplam] = useState(0);
  const [yaklasik, setYaklasik] = useState(true);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_yorum_liste", {
      p: {
        limit: SAYFA_BOYU,
        offset: sayfa * SAYFA_BOYU,
        ...(sekme === "bekleyen" ? { status: "pending" } : {}),
        ...(arama.trim() ? { q: arama.trim() } : {}),
      },
    });
    setYukleniyor(false);
    if (error) { t.error("Yorumlar okunamadı: " + error.message); return; }

    const o = data as {
      satirlar: Yorum[]; toplam: number; yaklasik: boolean;
    } | null;
    setListe(o?.satirlar ?? []);
    setToplam(o?.toplam ?? 0);
    setYaklasik(o?.yaklasik ?? true);
  }, [sb, t, sekme, arama, sayfa]);

  useEffect(() => { void yukle(); }, [yukle]);

  /* Sekme ya da arama değişince ilk sayfaya dön */
  useEffect(() => { setSayfa(0); }, [sekme, arama]);

  const gorunen = useMemo(() => {
    const a = arama.trim().toLowerCase();
    if (!a) return liste;
    return liste.filter((c) =>
      c.body.toLowerCase().includes(a) ||
      c.yazar.toLowerCase().includes(a) ||
      c.haber.toLowerCase().includes(a));
  }, [liste, arama]);

  const bekleyen = liste.filter((c) => c.status === "pending").length;

  async function denetle(c: Yorum, durum: "approved" | "rejected" | "spam") {
    // İyimser: tıklamada değişsin, sunucu onaylasın
    setListe((p) => p.map((x) => (x.id === c.id ? { ...x, status: durum } : x)));
    const { error } = await sb.rpc("moderate_comment", {
      p_comment_id: c.id, p_status: durum,
    });
    if (error) { t.error(error.message); await yukle(); return; }
    if (sekme === "bekleyen") setListe((p) => p.filter((x) => x.id !== c.id));
  }

  async function sil() {
    if (!silinecek) return;
    const hedef = silinecek;
    const { error } = await sb.rpc("delete_article_comment", { p_comment_id: hedef.id });
    setSilinecek(null);
    if (error) { t.error(error.message); return; }
    setListe((p) => p.filter((x) => x.id !== hedef.id));
    t.success("Yorum silindi");
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={sekme}
        onChange={(k) => setSekme(k as typeof sekme)}
        items={[
          { key: "hepsi", label: "Yorumlar", badge: liste.length || undefined },
          { key: "bekleyen", label: "Onay bekleyen", badge: bekleyen || undefined },
        ]}
      />

      <Input value={arama} onChange={(e) => setArama(e.target.value)}
        placeholder="Yorum, yazar ya da haber başlığında ara" />

      {yukleniyor ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : gorunen.length === 0 ? (
        <EmptyState
          title={sekme === "bekleyen" ? "Onay bekleyen yorum yok" : "Yorum yok"}
          description={arama ? "Farklı bir arama dene." : undefined}
        />
      ) : (
        <Card className="p-5">
          <CardHead title={`${gorunen.length} yorum`} desc="En yeni üstte." />
          <ul className="flex flex-col">
            {gorunen.map((c, i) => {
              const d = DURUM[c.status] ?? { l: c.status, t: "muted" as const };
              const foto = c.yazar_avatar ? `${cdn}/${c.yazar_avatar}` : null;
              return (
                <li key={c.id}
                  className={`flex gap-3 py-4 ${i > 0 ? "border-t border-line2" : ""}`}>
                  {/* Yazar — tıklayınca kullanıcı detayına */}
                  <Link href={c.user_id ? `/kullanici/${c.user_id}` : "#"}
                    title={`${c.yazar} — profili aç`}
                    className={`shrink-0 ${c.user_id ? "" : "pointer-events-none opacity-60"}`}>
                    {foto ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={foto} alt="" loading="lazy"
                        className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden
                        className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white"
                        style={{ background: `hsl(${ton(c.user_id ?? c.yazar)} 45% 32%)` }}>
                        {c.yazar_harf}
                      </span>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={c.user_id ? `/kullanici/${c.user_id}` : "#"}
                        className={`text-[13.5px] font-semibold ${c.user_id ? "hover:underline" : ""}`}>
                        {c.yazar_kullanici ? `@${c.yazar_kullanici}` : c.yazar}
                      </Link>
                      <Badge tone={d.t}>{d.l}</Badge>
                      {c.report_count > 0 && (
                        <Badge tone="danger">{c.report_count} şikâyet</Badge>
                      )}
                      <span className="kb-num text-[11.5px] text-muted2">
                        {new Date(c.created_at).toLocaleString("tr-TR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[14px] leading-relaxed">{c.body}</p>

                    <a href={`${site}/haber/${c.haber_slug}`} target="_blank" rel="noreferrer"
                      className="mt-1.5 block truncate text-[12.5px] text-muted transition-colors hover:text-ink">
                      {c.haber} ↗
                    </a>

                    {/*
                      ⚠ ONAYLANMIŞ YORUMDA YALNIZCA SİL.
                      "Reddet" ve "Spam" düğmeleri onaylanmış bir
                      yorumda anlamsızdı ve yanlışlıkla
                      tıklanabiliyordu. Karar verilmiş yorumda tek
                      seçenek kalıyor: silmek.
                    */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {c.status === "approved" ? (
                        <Button variant="ghost" size="sm" onClick={() => setSilinecek(c)}>
                          <Icon name="trash" size={14} /> Sil
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => denetle(c, "approved")}>
                            Onayla
                          </Button>
                          {c.status !== "rejected" && (
                            <Button variant="ghost" size="sm" onClick={() => denetle(c, "rejected")}>
                              Reddet
                            </Button>
                          )}
                          {c.status !== "spam" && (
                            <Button variant="ghost" size="sm" onClick={() => denetle(c, "spam")}>
                              Spam
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setSilinecek(c)}>
                            <Icon name="trash" size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {toplam > SAYFA_BOYU && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button variant="ghost" size="sm"
            disabled={sayfa === 0}
            onClick={() => { setSayfa((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0 }); }}>
            <Icon name="chevronLeft" size={16} /> Önceki
          </Button>
          <span className="kb-num px-3 text-[13px] text-muted">
            {sayfa + 1} / {Math.max(1, Math.ceil(toplam / SAYFA_BOYU))}
          </span>
          <Button variant="ghost" size="sm"
            disabled={sayfa + 1 >= Math.ceil(toplam / SAYFA_BOYU)}
            onClick={() => { setSayfa((s) => s + 1); window.scrollTo({ top: 0 }); }}>
            Sonraki <Icon name="chevronRight" size={16} />
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(silinecek)}
        onClose={() => setSilinecek(null)}
        title="Yorum silinsin mi?"
        description={silinecek?.body.slice(0, 160)}
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
