"use client";
import { useState, useCallback, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Field, Input, Switch, Badge,
  EmptyState, Skeleton, Divider,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   KATEGORİLER

   ┌─ ADRES DEĞİŞTİRİLEMEZ ⚠️ ─────────────────────────────────┐
   │ Menü hedefleri, dış bağlantılar ve aktarım aracının        │
   │ eşleme tablosu kategoriyi ADRESLE buluyor. Değiştirilirse  │
   │ hepsi sessizce kopar. Sunucu da reddediyor.                 │
   │                                                              │
   │ Adı istediğin gibi değiştirebilirsin — o güvenli.           │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface Kategori {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  color: string;
  text_color: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  show_in_menu: boolean;
  show_in_home: boolean;
}

const BOS = {
  id: "", slug: "", name: "", short_name: "", description: "",
  color: "#3b82f6", text_color: "#ffffff",
  sort_order: 100, is_active: true, show_in_menu: true, show_in_home: true,
};

const HAZIR_RENK = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#64748b",
];

export default function CategoriesPanel() {
  const sb = supabaseBrowser();
  const t = useToast();

  const [liste, setListe] = useState<Kategori[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<typeof BOS | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [silinecek, setSilinecek] = useState<Kategori | null>(null);

  /*
   * ⚠ SAYILAR LİSTEDEN AYRI YÜKLENİYOR.
   *
   * Önce görünüm her kategori için "kaç haber var" sayıyordu ve
   * 222.850 satırlık tabloyu tarıyordu — sayfa zaman aşımına
   * uğruyordu.
   *
   * Artık liste ANINDA geliyor, sayılar arkadan düşüyor.
   * Sayım başarısız olsa bile sayfa çalışmaya devam ediyor.
   */
  const [sayilar, setSayilar] = useState<Record<string, number> | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.from("admin_categories").select("*").order("sort_order");
    setYukleniyor(false);
    if (error) { t.error("Kategoriler okunamadı: " + error.message); return; }
    setListe((data ?? []) as unknown as Kategori[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      const { data } = await sb.rpc("admin_kategori_sayilari");
      if (!iptal && data) setSayilar(data as Record<string, number>);
    })();
    return () => { iptal = true; };
  }, [sb]);

  async function kaydet() {
    if (!form) return;
    if (!form.name.trim()) { t.error("Kategori adı zorunlu"); return; }
    if (!form.id && !form.slug.trim()) { t.error("Adres zorunlu"); return; }

    setKaydediyor(true);
    const { error } = await sb.rpc("admin_category_upsert", {
      p: {
        ...(form.id ? { id: form.id } : { slug: form.slug.trim().toLowerCase() }),
        name: form.name,
        short_name: form.short_name || null,
        description: form.description || null,
        color: form.color,
        text_color: form.text_color,
        sort_order: form.sort_order,
        is_active: form.is_active,
        show_in_menu: form.show_in_menu,
        show_in_home: form.show_in_home,
      },
    });
    setKaydediyor(false);
    if (error) { t.error(error.message); return; }
    t.success(form.id ? "Kategori güncellendi" : "Kategori eklendi");
    setForm(null);
    await yukle();
  }

  async function sil() {
    if (!silinecek) return;
    const { error } = await sb.rpc("admin_category_delete", { p_id: silinecek.id });
    setSilinecek(null);
    if (error) { t.error(error.message); return; }
    t.success("Kategori silindi");
    await yukle();
  }

  async function acKapa(k: Kategori, acik: boolean) {
    setListe((p) => p.map((x) => (x.id === k.id ? { ...x, is_active: acik } : x)));
    const { error } = await sb.rpc("admin_category_upsert", {
      p: { id: k.id, is_active: acik },
    });
    if (error) { t.error(error.message); await yukle(); }
  }

  if (yukleniyor) {
    return <div className="flex flex-col gap-3">
      <Skeleton className="h-64 w-full" />
    </div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <CardHead
          title={`${liste.length} kategori`}
          desc="Haberler bu kategorilere bağlanıyor. Sıra menüdeki dizilimi belirler."
          action={<Button size="sm" onClick={() => setForm({ ...BOS })}>
            <Icon name="plus" size={16} /> Kategori ekle
          </Button>}
        />

        {liste.length === 0 ? (
          <EmptyState title="Kategori yok" />
        ) : (
          <ul className="flex flex-col">
            {liste.map((k, i) => (
              <li key={k.id}
                className={`flex flex-wrap items-center gap-3 py-3 ${i > 0 ? "border-t border-line2" : ""}`}>
                {/* Renk örneği — sitede rozet böyle görünüyor */}
                <span
                  className="flex h-8 min-w-[64px] shrink-0 items-center justify-center rounded-full px-3 text-[11.5px] font-bold"
                  style={{ background: k.color, color: k.text_color }}
                >
                  {k.short_name || k.name}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold">{k.name}</span>
                    {k.show_in_menu && <Badge tone="accent">Menüde</Badge>}
                    {!k.show_in_home && <Badge tone="muted">Ana sayfada yok</Badge>}
                  </span>
                  <span className="kb-num mt-0.5 block text-[12.5px] text-muted2">
                    <code className="rounded-[7px] bg-chip px-1.5 py-0.5">{k.slug}</code>
                    {" · sıra "}{k.sort_order}
                    {sayilar && sayilar[k.id] !== undefined && (
                      <> · {sayilar[k.id]!.toLocaleString("tr-TR")} haber</>
                    )}
                  </span>
                </span>

                <Switch checked={k.is_active} onChange={(v) => acKapa(k, v)} label={k.name} />

                <span className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setForm({
                    id: k.id, slug: k.slug, name: k.name,
                    short_name: k.short_name ?? "", description: k.description ?? "",
                    color: k.color, text_color: k.text_color,
                    sort_order: k.sort_order, is_active: k.is_active,
                    show_in_menu: k.show_in_menu, show_in_home: k.show_in_home,
                  })}>
                    Düzenle
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSilinecek(k)}>
                    <Icon name="trash" size={14} />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {form && (
        <Card className="kb-scale p-6">
          <CardHead
            title={form.id ? form.name : "Yeni kategori"}
            desc={form.id
              ? "Adres değiştirilemez — menü hedefleri ve dış bağlantılar ona bağlı."
              : "Adres sonradan değiştirilemez, dikkatli seç."}
            action={<Button variant="ghost" size="sm" onClick={() => setForm(null)}>Vazgeç</Button>}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {!form.id && (
              <Field label="Adres" hint="küçük harf, tire">
                <Input value={form.slug} className="font-mono"
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="cevre" />
              </Field>
            )}
            <Field label="Ad">
              <Input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Çevre" />
            </Field>
            <Field label="Kısa ad" hint="rozette görünen — boşsa tam ad">
              <Input value={form.short_name}
                onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
            </Field>
            <Field label="Sıra" hint="küçük olan önce">
              <Input type="number" value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Açıklama" hint="kategori sayfasında görünür">
              <Input value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>

          <Divider className="my-5" />
          <div className="kb-eyebrow mb-3">Rozet rengi</div>
          <div className="flex flex-wrap items-center gap-4">
            {/* Canlı önizleme: sitede tam böyle görünecek */}
            <span
              className="flex h-9 min-w-[80px] items-center justify-center rounded-full px-4 text-[12.5px] font-bold"
              style={{ background: form.color, color: form.text_color }}
            >
              {form.short_name || form.name || "Örnek"}
            </span>

            <div className="flex flex-wrap gap-1.5">
              {HAZIR_RENK.map((r) => (
                <button key={r} type="button"
                  onClick={() => setForm({ ...form, color: r })}
                  aria-label={`Renk ${r}`}
                  className={`kb-lift h-8 w-8 rounded-full transition-transform ${
                    form.color === r ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                  }`}
                  style={{ background: r }}
                />
              ))}
            </div>

            <div className="max-w-[130px]">
              <Input value={form.color} className="font-mono text-[13px]"
                onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>

            <label className="flex items-center gap-2 text-[13px]">
              <span className="text-muted">Yazı</span>
              <select value={form.text_color}
                onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                className="rounded-[10px] border border-line2 bg-field px-3 py-2 text-[13px]">
                <option value="#ffffff">Beyaz</option>
                <option value="#000000">Siyah</option>
              </select>
            </label>
          </div>

          <Divider className="my-4" />
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2.5 text-[13.5px]">
              <Switch checked={form.is_active}
                onChange={(v) => setForm({ ...form, is_active: v })} label="Aktif" />
              <span>Aktif</span>
            </label>
            <label className="flex items-center gap-2.5 text-[13.5px]">
              <Switch checked={form.show_in_menu}
                onChange={(v) => setForm({ ...form, show_in_menu: v })} label="Menüde" />
              <span>Menüde göster</span>
            </label>
            <label className="flex items-center gap-2.5 text-[13.5px]">
              <Switch checked={form.show_in_home}
                onChange={(v) => setForm({ ...form, show_in_home: v })} label="Ana sayfa" />
              <span>Ana sayfada göster</span>
            </label>
            <div className="ms-auto flex gap-2">
              <Button variant="ghost" onClick={() => setForm(null)}>Vazgeç</Button>
              <Button onClick={kaydet} loading={kaydediyor}>Kaydet</Button>
            </div>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(silinecek)}
        onClose={() => setSilinecek(null)}
        title={`"${silinecek?.name}" silinsin mi?`}
        description={
          sayilar && silinecek && (sayilar[silinecek.id] ?? 0) > 0
            ? `${sayilar[silinecek.id]!.toLocaleString("tr-TR")} haber bu kategoride — silme reddedilecek. Onun yerine pasife al.`
            : "Geri alınamaz."
        }
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
