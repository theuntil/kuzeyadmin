"use client";
import { useState, useCallback, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Badge, EmptyState, Skeleton, Divider, StatCard,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";
import { medyaOnizleme } from "@/lib/medya-adres";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   HABER DETAYI

   Listeden tıklanınca gelinen ekran. Haberin her şeyi burada:
   istatistikler, medya, çeviriler, AI çıktısı ve yorumlar.

   Düzenleme AYRI ekranda — burası okumak için, orası
   değiştirmek için. Karıştırınca kazara değişiklik oluyor.
   ══════════════════════════════════════════════════════════════ */

export interface HaberDetayVeri {
  haber: Record<string, unknown> & {
    id: string; slug: string; title: string; summary: string | null;
    status: string; published_at: string | null; created_at: string;
    haber_kodu: string | null; son_dakika: boolean; tags: string[] | null;
    body: { type: string; text?: string }[] | null;
  };
  kategori: { name: string; color: string } | null;
  sehir: { name: string } | null;
  kaynak: { short_name: string; slug: string } | null;
  yazar: { ad: string | null; username: string | null };
  medya: {
    id: string; type: string; status: string;
    storage_key: string | null; poster_key: string | null;
    caption: string | null; width: number | null; height: number | null;
    duration_sec: number | null; last_error: string | null;
    /* Adres kurulumu için — bkz. lib/medya-adres.ts */
    variants?: Record<string, unknown> | null;
  }[];
  ai: {
    ozet: string | null; instagram: string | null;
    onem_puani: number | null; onem_gerekce: string | null;
    cocuk_guvenli: boolean | null; guvenlik_sebepleri: string[] | null;
    model: string | null; generated_at: string | null;
  } | null;
  ceviriler: {
    locale: string; baslik: string | null; ozet: string | null;
    status: string; error_message: string | null;
  }[];
  istatistik: {
    goruntulenme: number; begeni: number; yorum: number;
    kaydedilen: number; son_24_saat: number; puan: number;
    sayfa_ziyareti: number; tekil_okur: number;
  };
  yorumlar: {
    id: string; body: string; status: string; created_at: string;
    yazar: string; yazar_username: string | null; misafir: boolean;
    report_count: number;
  }[];
}

const DIL_AD: Record<string, string> = {
  en: "İngilizce", ar: "Arapça", ru: "Rusça", tr: "Türkçe",
};

function sayi(n: number): string {
  return n.toLocaleString("tr-TR");
}

/** Durum adları ve renkleri — panelin her yerinde aynı */
const DURUM_AD: Record<string, string> = {
  published: "Yayında",
  pending_review: "Onay bekliyor",
  rejected: "Reddedildi",
  draft: "Taslak",
  archived: "Arşiv",
};
const DURUM_TON: Record<string, "green" | "muted" | "accent" | "danger"> = {
  published: "green",
  pending_review: "accent",
  rejected: "danger",
  draft: "muted",
  archived: "muted",
};

export default function HaberDetay({
  id, cdnBase, siteUrl, canApprove = true,
}: {
  id: string;
  cdnBase: string;
  siteUrl: string;
  /** Yönetici mi — onay düğmeleri buna bağlı */
  canApprove?: boolean;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [v, setV] = useState<HaberDetayVeri | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [silinecek, setSilinecek] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_haber_detay", { p_id: id });
    setYukleniyor(false);
    if (error) { t.error(error.message); return; }
    setV(data as unknown as HaberDetayVeri);
  }, [sb, t, id]);

  useEffect(() => { void yukle(); }, [yukle]);

  const [onayIslem, setOnayIslem] = useState(false);

  /** Onay / red — kuyruktakiyle aynı fonksiyonlar */
  async function kararVer(onay: boolean) {
    setOnayIslem(true);
    const { error } = onay
      ? await sb.rpc("approve_article", { p_article_id: id })
      : await sb.rpc("reject_article", { p_article_id: id, p_note: null });
    setOnayIslem(false);

    if (error) { t.error(error.message); return; }
    t.success(onay ? "Haber yayınlandı" : "Haber reddedildi");
    await yukle();
  }

  async function yorumDurum(yorumId: string, yeni: "approved" | "rejected") {
    /*
     * ⚠ FONKSİYON ADI YANLIŞTI.
     *
     * `admin_comment_moderate` diye bir fonksiyon hiç yok;
     * doğrusu `moderate_comment` ve parametre adı da farklı
     * (`p_comment_id`, `p_id` değil). Panelden yorum onaylama
     * bu yüzden hiç çalışmıyordu.
     */
    const { error } = await sb.rpc("moderate_comment", {
      p_comment_id: yorumId, p_status: yeni,
    });
    if (error) { t.error(error.message); return; }
    t.success(yeni === "approved" ? "Yorum onaylandı" : "Yorum reddedildi");
    await yukle();
  }

  async function sil() {
    const { error } = await sb.rpc("editor_delete_article", { p_id: id });
    setSilinecek(false);
    if (error) { t.error(error.message); return; }
    t.success("Haber silindi");
    window.location.href = "/haberler";
  }

  if (yukleniyor) {
    return <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" />
    </div>;
  }
  if (!v) return <EmptyState title="Haber bulunamadı" />;

  const kapak = v.medya.find((m) => m.type === "image" && m.storage_key);
  const st = v.istatistik;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Başlık ve eylemler ── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          {kapak?.storage_key && (
            <span className="w-full overflow-hidden rounded-[14px] bg-chip sm:w-52">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={medyaOnizleme(kapak, cdn) ?? ""} alt=""
                className="aspect-[16/9] w-full object-cover" />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {/*
                ⚠ DURUM ADI TÜRKÇE.
                Eskiden `pending_review` gibi ham enum değeri
                basılıyordu; panelde ne anlama geldiği belli
                değildi.
              */}
              <Badge tone={DURUM_TON[v.haber.status] ?? "muted"}>
                {DURUM_AD[v.haber.status] ?? v.haber.status}
              </Badge>
              {v.haber.son_dakika && <Badge tone="danger">Son dakika</Badge>}
              {v.kategori && (
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white"
                  style={{ background: v.kategori.color }}>
                  {v.kategori.name}
                </span>
              )}
              {v.ai?.cocuk_guvenli === false && <Badge tone="danger">Çocuğa uygun değil</Badge>}
            </div>

            <h2 className="text-[19px] font-bold leading-snug">{v.haber.title}</h2>

            {v.haber.summary && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">
                {v.haber.summary}
              </p>
            )}

            <div className="kb-num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted2">
              <span>
                {v.haber.published_at
                  ? new Date(v.haber.published_at).toLocaleString("tr-TR")
                  : "Yayımlanmadı"}
              </span>
              {v.yazar.ad && <span>· {v.yazar.ad}</span>}
              {v.kaynak && <span>· {v.kaynak.short_name}</span>}
              {v.sehir && <span>· {v.sehir.name}</span>}
              {v.haber.haber_kodu && (
                <code className="rounded bg-chip px-1.5 py-0.5">{v.haber.haber_kodu}</code>
              )}
            </div>
          </div>
        </div>

        <Divider className="my-4" />

        {/*
          ONAY ŞERİDİ

          ⚠ Bekleyen habere tıklandığında onaylama yolu yoktu;
          yönetici düzenleme sayfasına girip durumu elle
          değiştirmek zorunda kalıyordu.
        */}
        {(v.haber.status === "pending_review" || v.haber.status === "rejected") && canApprove && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface2 p-4">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold">
                {v.haber.status === "pending_review"
                  ? "Bu haber onay bekliyor"
                  : "Bu haber reddedildi"}
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted2">
                {v.haber.status === "pending_review"
                  ? "Onaylarsan hemen yayına girer."
                  : "Yazar düzenleyip tekrar gönderebilir."}
              </div>
            </div>

            {v.haber.status === "pending_review" && (
              <Button variant="ghost" disabled={onayIslem}
                onClick={() => void kararVer(false)}>
                Reddet
              </Button>
            )}
            <Button disabled={onayIslem} onClick={() => void kararVer(true)}>
              {onayIslem ? "…" : "Onayla ve yayınla"}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { window.location.href = `/haberler/${id}/duzenle`; }}>
            <Icon name="edit" size={16} /> Düzenle
          </Button>
          {v.haber.status === "published" && (
            <Button variant="outline"
              onClick={() => window.open(`${siteUrl}/haber/${v.haber.slug}`, "_blank")}>
              <Icon name="eye" size={16} /> Sitede aç
            </Button>
          )}
          <Button variant="ghost" onClick={() => { window.location.href = "/haberler"; }}>
            Listeye dön
          </Button>
          <Button variant="ghost" className="ms-auto text-danger"
            onClick={() => setSilinecek(true)}>
            <Icon name="trash" size={15} /> Sil
          </Button>
        </div>
      </Card>

      {/* ── İstatistikler ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Okunma" value={sayi(st.goruntulenme)}
          hint={`${sayi(st.tekil_okur)} tekil okur`} />
        <StatCard label="Beğeni" value={sayi(st.begeni)} />
        <StatCard label="Yorum" value={sayi(st.yorum)}
          hint={v.yorumlar.filter((y) => y.status === "pending").length > 0
            ? `${v.yorumlar.filter((y) => y.status === "pending").length} onay bekliyor`
            : undefined} />
        <StatCard label="Kaydedilen" value={sayi(st.kaydedilen)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Son 24 saat" value={sayi(st.son_24_saat)} />
        <StatCard label="Sayfa ziyareti" value={sayi(st.sayfa_ziyareti)}
          hint="okumadan ayrı sayılır" />
        <StatCard label="Sıralama puanı" value={sayi(Math.round(st.puan))} />
      </div>

      {/* ── Medya ── */}
      {v.medya.length > 0 && (
        <Card className="p-5">
          <CardHead title={`${v.medya.length} medya`}
            desc="Görseller ve videolar" />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {v.medya.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-[14px] bg-chip">
                <span className="relative block aspect-[4/3] w-full">
                  {(m.storage_key || m.poster_key) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={medyaOnizleme(m, cdn) ?? ""} alt=""
                      className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted2">
                      <Icon name="media" size={20} />
                    </span>
                  )}
                  {m.type === "video" && (
                    <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white">
                      <Icon name="play" size={11} />
                    </span>
                  )}
                  {m.status !== "ready" && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-orange-soft px-1.5 py-0.5 text-[10px] font-bold text-orange-ink">
                      {m.status}
                    </span>
                  )}
                </span>
                {(m.caption || m.last_error) && (
                  <span className="block p-2 text-[11.5px] leading-snug">
                    {m.last_error ? (
                      <span className="text-danger">{m.last_error}</span>
                    ) : m.caption}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── AI çıktısı ── */}
      {v.ai && (
        <Card className="p-5">
          <CardHead title="AI değerlendirmesi"
            desc={v.ai.model ? `${v.ai.model} · ${v.ai.generated_at ? new Date(v.ai.generated_at).toLocaleString("tr-TR") : ""}` : undefined} />
          <dl className="flex flex-col gap-3">
            {v.ai.ozet && (
              <div>
                <dt className="kb-eyebrow mb-1">Özet</dt>
                <dd className="text-[13.5px] leading-relaxed">{v.ai.ozet}</dd>
              </div>
            )}
            {v.ai.instagram && (
              <div>
                <dt className="kb-eyebrow mb-1">Instagram metni</dt>
                <dd className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {v.ai.instagram}
                </dd>
              </div>
            )}
            {v.ai.onem_puani !== null && (
              <div>
                <dt className="kb-eyebrow mb-1">Önem puanı</dt>
                <dd className="kb-num text-[13.5px]">
                  {v.ai.onem_puani} / 10
                  {v.ai.onem_gerekce && (
                    <span className="text-muted2"> — {v.ai.onem_gerekce}</span>
                  )}
                </dd>
              </div>
            )}
            {v.ai.cocuk_guvenli !== null && (
              <div>
                <dt className="kb-eyebrow mb-1">Çocuk güvenliği</dt>
                <dd className="text-[13.5px]">
                  {v.ai.cocuk_guvenli ? "Uygun" : "Uygun değil"}
                  {v.ai.guvenlik_sebepleri?.length ? (
                    <span className="text-muted2"> — {v.ai.guvenlik_sebepleri.join(", ")}</span>
                  ) : null}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* ── Çeviriler ── */}
      {v.ceviriler.length > 0 && (
        <Card className="p-5">
          <CardHead title="Diğer dil sürümleri" />
          <ul className="flex flex-col">
            {v.ceviriler.map((c, i) => (
              <li key={c.locale}
                className={`py-3 ${i > 0 ? "border-t border-line2" : ""}`}>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="muted">{DIL_AD[c.locale] ?? c.locale}</Badge>
                  {c.status !== "ready" && <Badge tone="accent">{c.status}</Badge>}
                </div>
                <div className="text-[13.5px] font-medium">{c.baslik ?? "—"}</div>
                {c.ozet && (
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                    {c.ozet}
                  </div>
                )}
                {c.error_message && (
                  <div className="mt-1 text-[12px] text-danger">{c.error_message}</div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Yorumlar ── */}
      <Card className="p-5">
        <CardHead title={`${v.yorumlar.length} yorum`}
          desc={v.yorumlar.length > 0 ? "Onay bekleyenleri buradan yönetebilirsin." : undefined} />
        {v.yorumlar.length === 0 ? (
          <EmptyState title="Yorum yok" />
        ) : (
          <ul className="flex flex-col">
            {v.yorumlar.map((y, i) => (
              <li key={y.id}
                className={`flex flex-wrap items-start gap-3 py-3 ${i > 0 ? "border-t border-line2" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center gap-2">
                    {y.yazar_username ? (
                      <Link href={`/kullanici?u=${y.yazar_username}`}
                        className="text-[13px] font-semibold hover:underline">
                        {y.yazar}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-semibold">{y.yazar}</span>
                    )}
                    {y.misafir && <Badge tone="muted">Misafir</Badge>}
                    {y.status === "pending" && <Badge tone="accent">Onay bekliyor</Badge>}
                    {y.status === "rejected" && <Badge tone="danger">Reddedildi</Badge>}
                    {y.report_count > 0 && (
                      <Badge tone="danger">{y.report_count} şikâyet</Badge>
                    )}
                    <span className="kb-num text-[11.5px] text-muted2">
                      {new Date(y.created_at).toLocaleString("tr-TR")}
                    </span>
                  </span>
                  <span className="block text-[13.5px] leading-relaxed">{y.body}</span>
                </span>

                {y.status !== "approved" && (
                  <Button variant="ghost" size="sm"
                    onClick={() => yorumDurum(y.id, "approved")}>
                    Onayla
                  </Button>
                )}
                {y.status !== "rejected" && (
                  <Button variant="ghost" size="sm"
                    onClick={() => yorumDurum(y.id, "rejected")}>
                    Reddet
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={silinecek}
        onClose={() => setSilinecek(false)}
        title="Haber silinsin mi?"
        description="Haber çöp kutusuna taşınır. Medyası da silinir."
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
