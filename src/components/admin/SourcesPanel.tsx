"use client";
import { useState, useCallback, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Field, Input, Textarea, Switch, Badge,
  EmptyState, Skeleton, Divider,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";
import SosyalDuzenle, { type Sosyal } from "@/components/admin/SosyalDuzenle";

/* ══════════════════════════════════════════════════════════════
   HABER KAYNAKLARI

   Haberlerin altında görünen ajans etiketi ve logosu buradan
   geliyor. `articles.source_id` bu tabloya bağ tutuyor — adı
   değiştirince tüm haberlerde birden değişir.

   ┌─ DÜZENLEME AÇILIR PENCEREDE ⚠️ ───────────────────────────┐
   │ Önce liste ile aynı ekranda, altında açılıyordu. Uzun      │
   │ listede form ekranın dışında kalıyor, kullanıcı aşağı      │
   │ kaydırmak zorunda kalıyordu. Modal odağı forma alıyor.     │
   └──────────────────────────────────────────────────────────────┘

   ┌─ İKİ LOGO ⚠️ ─────────────────────────────────────────────┐
   │ Açık ve koyu tema için ayrı. Çoğu ajans logosu koyu        │
   │ renkli; koyu temada görünmez olur.                          │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface Kaynak {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  logo_key: string | null;
  logo_dark_key: string | null;
  cover_key: string | null;
  website: string | null;
  description: string | null;
  email: string | null;
  social_links: Sosyal | null;
  is_agency: boolean;
  is_active: boolean;
  sort_order: number;
}

const BOS = {
  id: "", slug: "", name: "", short_name: "",
  logo_key: "", logo_dark_key: "", cover_key: "",
  website: "", description: "", email: "",
  is_agency: true, is_active: true, sort_order: 100,
};

/** Sistem kaynakları silinemez — bot ve aktarım bunları slug ile arıyor */
const SISTEM = new Set(["iha", "kuzeybati"]);

export default function SourcesPanel({ cdnBase }: { cdnBase: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [liste, setListe] = useState<Kaynak[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<typeof BOS | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [gorselYuk, setGorselYuk] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<Kaynak | null>(null);
  /** Sosyal bağlantılar ana "Kaydet" ile birlikte gidiyor */
  const [sosyal, setSosyal] = useState<Sosyal | null>(null);
  const [sayilar, setSayilar] = useState<Record<string, number> | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.from("admin_sources").select("*").order("sort_order");
    setYukleniyor(false);
    if (error) { t.error("Kaynaklar okunamadı: " + error.message); return; }
    setListe((data ?? []) as unknown as Kaynak[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  /* Sayılar listeden ayrı: liste anında gelsin */
  useEffect(() => {
    let iptal = false;
    void (async () => {
      const { data } = await sb.rpc("admin_kaynak_sayilari");
      if (!iptal && data) setSayilar(data as Record<string, number>);
    })();
    return () => { iptal = true; };
  }, [sb]);

  const secili = form?.id ? liste.find((x) => x.id === form.id) ?? null : null;

  async function gorselYukle(f: File, alan: "logo_key" | "logo_dark_key" | "cover_key") {
    if (!form) return;
    setGorselYuk(alan);
    try {
      const { key } = await r2Yukle(f, "library", `kaynak-${alan}-${f.name}`);
      // Kitaplığa da kaydet: Medya sayfasından yönetilebilsin
      await sb.rpc("library_add", {
        p_key: key, p_name: f.name, p_mime: f.type || "image/png",
        p_bytes: f.size, p_width: null, p_height: null,
        p_title: null, p_alt: "Kaynak görseli",
      });
      setForm({ ...form, [alan]: key });
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Görsel yüklenemedi");
    } finally {
      setGorselYuk(null);
    }
  }

  async function kaydet() {
    if (!form) return;
    if (!form.name.trim()) { t.error("Kaynak adı zorunlu"); return; }
    if (!form.id && !form.slug.trim()) { t.error("Adres zorunlu"); return; }

    setKaydediyor(true);
    const { error } = await sb.rpc("admin_source_upsert", {
      p: {
        ...(form.id ? { id: form.id } : { slug: form.slug.trim().toLowerCase() }),
        name: form.name,
        short_name: form.short_name || form.name,
        logo_key: form.logo_key || null,
        logo_dark_key: form.logo_dark_key || null,
        cover_key: form.cover_key || null,
        website: form.website || null,
        description: form.description || null,
        email: form.email || null,
        is_agency: form.is_agency,
        is_active: form.is_active,
        sort_order: form.sort_order,
        ...(sosyal ? { social_links: sosyal } : {}),
      },
    });
    setKaydediyor(false);
    if (error) { t.error(error.message); return; }
    t.success(form.id ? "Kaynak güncellendi" : "Kaynak eklendi");
    setForm(null);
    setSosyal(null);
    await yukle();
  }

  async function sil() {
    if (!silinecek) return;
    const { error } = await sb.rpc("admin_source_delete", { p_id: silinecek.id });
    setSilinecek(null);
    if (error) { t.error(error.message); return; }
    t.success("Kaynak silindi");
    await yukle();
  }

  async function acKapa(k: Kaynak, acik: boolean) {
    setListe((p) => p.map((x) => (x.id === k.id ? { ...x, is_active: acik } : x)));
    const { error } = await sb.rpc("admin_source_upsert", { p: { id: k.id, is_active: acik } });
    if (error) { t.error(error.message); await yukle(); }
  }

  const url = (k: string | null) => (k ? `${cdn}/${k}` : null);

  if (yukleniyor) {
    return <div className="flex flex-col gap-3"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <CardHead
          title={`${liste.length} kaynak`}
          desc="Haberlerin altındaki ajans etiketi, logosu ve yayıncı sayfası."
          action={<Button size="sm" onClick={() => setForm({ ...BOS })}>
            <Icon name="plus" size={16} /> Kaynak ekle
          </Button>}
        />

        {liste.length === 0 ? (
          <EmptyState title="Kaynak yok" />
        ) : (
          <ul className="flex flex-col">
            {liste.map((k, i) => (
              <li key={k.id}
                className={`flex flex-wrap items-center gap-3 py-3.5 ${i > 0 ? "border-t border-line2" : ""}`}>
                {/* Logo önizleme — açık ve koyu yan yana */}
                <span className="flex shrink-0 gap-1.5">
                  <span className="flex h-11 w-16 items-center justify-center rounded-[10px] bg-white p-1.5">
                    {url(k.logo_key) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url(k.logo_key)!} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] font-semibold text-black/40">açık</span>
                    )}
                  </span>
                  <span className="flex h-11 w-16 items-center justify-center rounded-[10px] bg-black p-1.5">
                    {url(k.logo_dark_key) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url(k.logo_dark_key)!} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] font-semibold text-white/40">koyu</span>
                    )}
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold">{k.name}</span>
                    <Badge tone="muted">{k.short_name}</Badge>
                    {k.is_agency && <Badge tone="accent">Ajans</Badge>}
                    {SISTEM.has(k.slug) && <Badge tone="muted">Sistem</Badge>}
                    {k.social_links && Object.keys(k.social_links).length > 0 && (
                      <Badge tone="green">
                        {Object.keys(k.social_links).length} bağlantı
                      </Badge>
                    )}
                  </span>
                  <span className="kb-num mt-0.5 block text-[12.5px] text-muted2">
                    <code className="rounded-[7px] bg-chip px-1.5 py-0.5">{k.slug}</code>
                    {sayilar && sayilar[k.id] !== undefined && (
                      <> · {sayilar[k.id]!.toLocaleString("tr-TR")} haber</>
                    )}
                    {k.website ? ` · ${k.website}` : ""}
                  </span>
                </span>

                <Switch checked={k.is_active} onChange={(v) => acKapa(k, v)} label={k.name} />

                <span className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setForm({
                    id: k.id, slug: k.slug, name: k.name, short_name: k.short_name,
                    logo_key: k.logo_key ?? "", logo_dark_key: k.logo_dark_key ?? "",
                    cover_key: k.cover_key ?? "",
                    website: k.website ?? "", description: k.description ?? "",
                    email: k.email ?? "",
                    is_agency: k.is_agency, is_active: k.is_active, sort_order: k.sort_order,
                  })}>
                    Düzenle
                  </Button>
                  {!SISTEM.has(k.slug) && (
                    <Button variant="ghost" size="sm" onClick={() => setSilinecek(k)}>
                      <Icon name="trash" size={14} />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ══ Düzenleme — açılır pencere ══ */}
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? form.name : "Yeni kaynak"}
        wide
      >
        {form && (
          <div className="flex flex-col gap-5">
            <p className="text-[13px] leading-relaxed text-muted">
              {form.id
                ? "Adres değiştirilemez — bot ve aktarım aracı kaynağı adresle buluyor."
                : "Adres sonradan değiştirilemez, dikkatli seç."}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {!form.id && (
                <Field label="Adres" hint="küçük harf, tire">
                  <Input value={form.slug} className="font-mono"
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="aa" />
                </Field>
              )}
              <Field label="Tam ad">
                <Input value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Anadolu Ajansı" />
              </Field>
              <Field label="Kısa ad" hint="haber altında görünen">
                <Input value={form.short_name}
                  onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                  placeholder="AA" />
              </Field>
              <Field label="E-posta" hint="isteğe bağlı">
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="iletisim@aa.com.tr" />
              </Field>
              <Field label="Sıra">
                <Input type="number" value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </Field>
            </div>

            <Field label="Tanıtım yazısı" hint="yayıncı sayfasında görünür · en fazla 2000 karakter">
              <Textarea value={form.description}
                className="min-h-[110px]"
                maxLength={2000}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Kaynak hakkında kısa bilgi…" />
            </Field>

            <Divider />
            <div>
              <div className="kb-eyebrow mb-3">Görseller</div>
              <div className="grid gap-5 sm:grid-cols-3">
                {([
                  ["logo_key", "Açık tema logosu", "bg-white", "koyu renkli logo"],
                  ["logo_dark_key", "Koyu tema logosu", "bg-black", "açık renkli logo"],
                  ["cover_key", "Kapak görseli", "bg-chip", "yayıncı sayfası başlığı"],
                ] as const).map(([alan, etiket, zemin, ipucu]) => (
                  <div key={alan}>
                    <div className="mb-2 text-[13px] font-semibold">{etiket}</div>
                    <span className={`mb-2 flex h-20 w-full items-center justify-center overflow-hidden rounded-[12px] p-2 ${zemin}`}>
                      {form[alan] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`${cdn}/${form[alan]}`} alt=""
                          className={alan === "cover_key" ? "h-full w-full object-cover" : "h-full w-full object-contain"} />
                      ) : (
                        <Icon name="media" size={18} />
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer">
                        <span className="kb-lift inline-flex items-center gap-1.5 rounded-full border border-line2 bg-chip px-3 py-1.5 text-[12.5px] font-semibold">
                          <Icon name={gorselYuk === alan ? "loading" : "media"} size={14} />
                          {gorselYuk === alan ? "Yükleniyor…" : "Yükle"}
                        </span>
                        <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void gorselYukle(f, alan); e.target.value = ""; }} />
                      </label>
                      {form[alan] && (
                        <button type="button"
                          onClick={() => setForm({ ...form, [alan]: "" })}
                          className="text-[12px] text-muted hover:text-danger">
                          Kaldır
                        </button>
                      )}
                    </div>
                    <span className="mt-1 block text-[11.5px] text-muted2">{ipucu}</span>
                  </div>
                ))}
              </div>
            </div>

            {/*
              Sosyal bağlantılar yalnızca KAYITLI kaynakta.
              Yeni kayıtta henüz kimlik yok; önce kaydedilip
              sonra eklenmesi gerekiyor.
            */}
            {form.id && (
              <>
                <Divider />
                <SosyalDuzenle
                  tur="kaynak"
                  id={form.id}
                  mevcut={secili?.social_links ?? null}
                  ayriKaydet={false}
                  onDegisti={setSosyal}
                />
              </>
            )}

            <Divider />
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2.5 text-[13.5px]">
                <Switch checked={form.is_agency}
                  onChange={(v) => setForm({ ...form, is_agency: v })} label="Ajans" />
                <span>Haber ajansı</span>
              </label>
              <label className="flex items-center gap-2.5 text-[13.5px]">
                <Switch checked={form.is_active}
                  onChange={(v) => setForm({ ...form, is_active: v })} label="Aktif" />
                <span>Aktif</span>
              </label>
              <div className="ms-auto flex gap-2">
                <Button variant="ghost" onClick={() => setForm(null)}>Vazgeç</Button>
                <Button onClick={kaydet} loading={kaydediyor}>Kaydet</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(silinecek)}
        onClose={() => setSilinecek(null)}
        title={`"${silinecek?.name}" silinsin mi?`}
        description={
          sayilar && silinecek && (sayilar[silinecek.id] ?? 0) > 0
            ? `${sayilar[silinecek.id]} haber bu kaynağı kullanıyor — silme reddedilecek. Onun yerine pasife al.`
            : "Geri alınamaz."
        }
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
