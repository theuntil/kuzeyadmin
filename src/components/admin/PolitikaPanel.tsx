"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Badge, Button, EmptyState, Card } from "@/components/ui";
import { d } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════
   POLİTİKALAR

   Yasal metinler — sürümlü ve onay takipli.

   ┌─ NEDEN `pages`'TEN AYRI ⚠️ ───────────────────────────────┐
   │ Politikaların sıradan sayfalarda olmayan üç ihtiyacı var: │
   │ sürüm, yürürlük tarihi ve kim hangi sürümü onayladı.      │
   │ KVKK metin değiştiğinde eski onayı geçersiz sayıyor.      │
   │                                                              │
   │ ⚠ SÜRÜM ELLE ARTIRILIYOR. Yazım hatası düzeltmek yeni      │
   │ sürüm gerektirmiyor; anlamı değiştiren güncelleme          │
   │ gerektiriyor. Kararı yönetici veriyor.                     │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const DILLER = ["tr", "en", "ar", "ru"] as const;
type Dil = typeof DILLER[number];

interface Politika {
  id: string;
  slug: string;
  title: Record<string, string>;
  body: Record<string, string>;
  seo_description: Record<string, string>;
  version: number;
  effective_at: string;
  requires_consent: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
  onay_sayisi: number;
  surum_sayisi: number;
}

const BOS: Politika = {
  id: "", slug: "", title: {}, body: {}, seo_description: {},
  version: 1, effective_at: new Date().toISOString().slice(0, 10),
  requires_consent: false, is_active: true, sort_order: 100,
  updated_at: "", onay_sayisi: 0, surum_sayisi: 0,
};

export default function PolitikaPanel() {
  const sb = supabaseBrowser();
  const t = useToast();

  const [liste, setListe] = useState<Politika[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<Politika | null>(null);
  const [dil, setDil] = useState<Dil>("tr");
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb
      .from("admin_politikalar")
      .select("*")
      .order("sort_order");
    setYukleniyor(false);
    if (error) { t.error("Politikalar okunamadı: " + error.message); return; }
    setListe((data ?? []) as Politika[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  async function kaydet() {
    if (!form) return;
    if (!form.slug.trim()) { t.error("Adres (slug) zorunlu"); return; }

    setBusy(true);
    const { error } = await sb.rpc("admin_politika_kaydet", {
      p: {
        id: form.id || null,
        slug: form.slug.trim(),
        title: form.title,
        body: form.body,
        seo_description: form.seo_description,
        version: form.version,
        effective_at: form.effective_at,
        requires_consent: form.requires_consent,
        is_active: form.is_active,
        sort_order: form.sort_order,
      },
    });
    setBusy(false);

    if (error) { t.error(error.message); return; }
    t.success("Kaydedildi");
    setForm(null);
    await yukle();
  }

  async function sil(p: Politika) {
    if (p.onay_sayisi > 0) {
      t.error(`Bu politikaya ${p.onay_sayisi} onay verilmiş, silinemez. Pasife al.`);
      return;
    }
    setBusy(true);
    const { error } = await sb.rpc("admin_politika_sil", { p_id: p.id });
    setBusy(false);
    if (error) { t.error(error.message); return; }
    t.success("Silindi");
    await yukle();
  }

  const alan = (
    k: "title" | "body" | "seo_description",
    etiket: string,
    satir = 1,
  ) => (
    <label className="mb-3 block">
      <span className="kb-eyebrow mb-1.5 block">{etiket} ({dil})</span>
      {satir > 1 ? (
        <textarea
          className="w-full resize-y rounded-xl border border-line bg-surface2 p-3 text-[14px] leading-relaxed"
          style={{ minHeight: satir * 34 }}
          dir={dil === "ar" ? "rtl" : "ltr"}
          value={form?.[k]?.[dil] ?? ""}
          onChange={(e) => setForm((f) =>
            f ? { ...f, [k]: { ...f[k], [dil]: e.target.value } } : f)}
        />
      ) : (
        <input
          className="w-full"
          dir={dil === "ar" ? "rtl" : "ltr"}
          value={form?.[k]?.[dil] ?? ""}
          onChange={(e) => setForm((f) =>
            f ? { ...f, [k]: { ...f[k], [dil]: e.target.value } } : f)}
        />
      )}
    </label>
  );

  if (yukleniyor) {
    return (
      <div className="grid gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-surface2" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] leading-relaxed text-muted2">
          {liste.length} politika. Sürüm artırdığında eski metin
          arşivleniyor ve kullanıcılardan yeniden onay isteniyor.
        </p>
        <Button onClick={() => { setForm({ ...BOS }); setDil("tr"); }}>
          Yeni politika
        </Button>
      </div>

      {/* ---- düzenleme formu ---- */}
      {form && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            {DILLER.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setDil(x)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                  dil === x ? "bg-fg text-bg" : "border border-line text-muted"
                }`}
              >
                {x.toUpperCase()}
              </button>
            ))}
          </div>

          {alan("title", "Başlık")}
          {alan("seo_description", "SEO açıklaması", 2)}
          {alan("body", "Metin", 10)}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="kb-eyebrow mb-1.5 block">Adres (slug)</span>
              <input
                className="w-full"
                value={form.slug}
                placeholder="gizlilik"
                onChange={(e) => setForm((f) => f ? { ...f, slug: e.target.value } : f)}
              />
            </label>

            <label className="block">
              <span className="kb-eyebrow mb-1.5 block">Sürüm</span>
              <input
                type="number" min={1} className="w-full"
                value={form.version}
                onChange={(e) => setForm((f) =>
                  f ? { ...f, version: Number(e.target.value) || 1 } : f)}
              />
            </label>

            <label className="block">
              <span className="kb-eyebrow mb-1.5 block">Yürürlük tarihi</span>
              <input
                type="date" className="w-full"
                value={form.effective_at.slice(0, 10)}
                onChange={(e) => setForm((f) =>
                  f ? { ...f, effective_at: e.target.value } : f)}
              />
            </label>

            <label className="block">
              <span className="kb-eyebrow mb-1.5 block">Sıra</span>
              <input
                type="number" className="w-full"
                value={form.sort_order}
                onChange={(e) => setForm((f) =>
                  f ? { ...f, sort_order: Number(e.target.value) || 100 } : f)}
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2">
            <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] font-semibold">
              <input
                type="checkbox" className="h-[18px] w-[18px] accent-fg"
                checked={form.requires_consent}
                onChange={(e) => setForm((f) =>
                  f ? { ...f, requires_consent: e.target.checked } : f)}
              />
              Kullanıcı onayı gerektirir
            </label>
            <p className="ml-7 text-[12px] leading-relaxed text-muted2">
              Gizlilik ve kullanım şartları için işaretle. Sürüm
              değiştiğinde kullanıcıdan yeniden onay istenir.
            </p>

            <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-[13.5px] font-semibold">
              <input
                type="checkbox" className="h-[18px] w-[18px] accent-fg"
                checked={form.is_active}
                onChange={(e) => setForm((f) =>
                  f ? { ...f, is_active: e.target.checked } : f)}
              />
              Yayında
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>Vazgeç</Button>
            <Button onClick={() => void kaydet()} disabled={busy}>
              {busy ? "…" : "Kaydet"}
            </Button>
          </div>
        </Card>
      )}

      {/* ---- liste ---- */}
      {liste.length === 0 ? (
        <EmptyState
          title="Politika yok"
          description="Gizlilik, kullanım şartları gibi yasal metinleri buradan ekle."
        />
      ) : (
        <div className="grid gap-3">
          {liste.map((p) => (
            <article
              key={p.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-bold">
                    {p.title?.tr || p.slug}
                  </span>
                  <Badge tone="muted">v{p.version}</Badge>
                  {p.requires_consent && <Badge tone="accent">Onay gerekli</Badge>}
                  {!p.is_active && <Badge tone="danger">Pasif</Badge>}
                </div>
                <div className="truncate text-[12.5px] text-muted2">
                  /{p.slug} · {d(p.effective_at)} tarihinden geçerli
                  {p.onay_sayisi > 0 && ` · ${p.onay_sayisi} onay`}
                  {p.surum_sayisi > 0 && ` · ${p.surum_sayisi} eski sürüm`}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm({
                      ...p,
                      title: p.title ?? {},
                      body: p.body ?? {},
                      seo_description: p.seo_description ?? {},
                    });
                    setDil("tr");
                  }}
                >
                  Düzenle
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || p.onay_sayisi > 0}
                  title={p.onay_sayisi > 0 ? "Onay verilmiş politika silinemez" : "Sil"}
                  onClick={() => void sil(p)}
                >
                  Sil
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
