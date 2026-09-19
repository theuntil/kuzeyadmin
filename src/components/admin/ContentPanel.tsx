"use client";
import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Tabs, Field, Input, Textarea, Select,
  Switch, Badge, Alert, EmptyState, Skeleton, Divider,
  TableWrap, Table, Th, Td,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   SİTE İÇERİĞİ

   Üç şey tek ekranda: menü, kurumsal sayfalar, reklam alanları.
   Üçü de az sayıda kayıt tutuyor ve birlikte düzenleniyor —
   ayrı menü öğesi yapmak menüyü şişirirdi.

   ┌─ DÖRT DİL ⚠️ ─────────────────────────────────────────────┐
   │ Menü etiketi ve sayfa gövdesi JSONB, dile göre. Eksik dil │
   │ Türkçeye düşüyor. Panelde hangi dillerin dolu olduğu       │
   │ rozetlerle görünüyor; boş bırakılan dil sessizce Türkçe    │
   │ gösterildiği için fark edilmesi zor olurdu.                 │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const DILLER = ["tr", "en", "ar", "ru"] as const;
type Dil = (typeof DILLER)[number];

const YER = ["header", "mobile", "footer", "drawer", "services"] as const;
const YER_ETIKET: Record<string, string> = {
  header: "Üst menü", mobile: "Mobil", footer: "Alt menü",
  drawer: "Çekmece", services: "Hizmetler",
};

const TUR = ["home", "category", "city", "page", "url", "video", "search"] as const;
const TUR_ETIKET: Record<string, string> = {
  home: "Ana sayfa", category: "Kategori", city: "Şehir",
  page: "Kurumsal sayfa", url: "Dış bağlantı", video: "Video", search: "Arama",
};

const YERLESIM = ["home-top", "home-feed", "article-mid", "sidebar"] as const;
const YERLESIM_ETIKET: Record<string, string> = {
  "home-top": "Ana sayfa üstü", "home-feed": "Akış arası",
  "article-mid": "Haber ortası", "sidebar": "Kenar sütunu",
};

interface NavRow {
  id: string; location: string; kind: string;
  label: Record<string, string>; target_slug: string | null;
  url: string | null; sort_order: number; is_active: boolean;
  open_new_tab: boolean; target_ok: boolean; display_label: string;
}
interface PageRow {
  id: string; slug: string; title: Record<string, string>;
  body: Record<string, string>; seo_description: Record<string, string>;
  is_active: boolean; sort_order: number;
  display_title: string; filled_locales: string[]; in_menu: boolean;
}
interface AdRow {
  id: string; placement: string; name: string; advertiser: string | null;
  image_key: string | null; target_url: string | null;
  headline: string | null; body: string | null; cta_label: string | null;
  has_embed: boolean; locale: string | null; is_active: boolean;
  starts_at: string | null; ends_at: string | null;
  impressions: number; clicks: number; ctr_yuzde: number | null; yayinda: boolean;
}

const BOS_NAV = {
  id: "", location: "header", kind: "category",
  label: { tr: "" } as Record<string, string>,
  target_slug: "", url: "", sort_order: 100, is_active: true, open_new_tab: false,
};
const BOS_PAGE = {
  id: "", slug: "",
  title: { tr: "" } as Record<string, string>,
  body: { tr: "" } as Record<string, string>,
  is_active: true, sort_order: 100,
};
const BOS_AD = {
  id: "", placement: "home-top", name: "", advertiser: "",
  image_key: "", target_url: "", headline: "", body: "", cta_label: "",
  locale: "", is_active: true, starts_at: "", ends_at: "", sort_order: 100,
};

export default function ContentPanel({
  categories, cities,
}: {
  categories: { slug: string; name: string }[];
  cities: { slug: string; name: string }[];
}) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [bolum, setBolum] = useState<"menu" | "sayfa" | "reklam">("menu");
  const [yukleniyor, setYukleniyor] = useState(true);

  const [navlar, setNavlar] = useState<NavRow[]>([]);
  const [sayfalar, setSayfalar] = useState<PageRow[]>([]);
  const [reklamlar, setReklamlar] = useState<AdRow[]>([]);

  const [navD, setNavD] = useState<typeof BOS_NAV | null>(null);
  const [sayfaD, setSayfaD] = useState<typeof BOS_PAGE | null>(null);
  const [reklamD, setReklamD] = useState<typeof BOS_AD | null>(null);
  const [dil, setDil] = useState<Dil>("tr");
  const [silinecek, setSilinecek] = useState<{ tur: string; id: string; ad: string } | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const [n, s, r] = await Promise.all([
      sb.from("admin_nav").select("*").order("location").order("sort_order"),
      sb.from("admin_pages").select("*").order("sort_order"),
      sb.from("admin_ads").select("*").order("placement").order("sort_order"),
    ]);
    setYukleniyor(false);
    if (n.error) { t.error("Menü okunamadı: " + n.error.message); return; }
    setNavlar((n.data ?? []) as unknown as NavRow[]);
    setSayfalar((s.data ?? []) as unknown as PageRow[]);
    setReklamlar((r.data ?? []) as unknown as AdRow[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  /* ---- Kaydetme ---- */
  async function navKaydet() {
    if (!navD) return;
    const { error } = await sb.rpc("admin_nav_upsert", {
      p: {
        ...(navD.id ? { id: navD.id } : {}),
        location: navD.location, kind: navD.kind, label: navD.label,
        target_slug: navD.target_slug || null, url: navD.url || null,
        sort_order: navD.sort_order, is_active: navD.is_active,
        open_new_tab: navD.open_new_tab,
      },
    });
    if (error) { t.error(error.message); return; }
    t.success(navD.id ? "Menü öğesi güncellendi" : "Menüye eklendi");
    setNavD(null); await yukle();
  }

  async function sayfaKaydet() {
    if (!sayfaD) return;
    const { error } = await sb.rpc("admin_page_upsert", {
      p: {
        ...(sayfaD.id ? { id: sayfaD.id } : { slug: sayfaD.slug }),
        title: sayfaD.title, body: sayfaD.body,
        is_active: sayfaD.is_active, sort_order: sayfaD.sort_order,
      },
    });
    if (error) { t.error(error.message); return; }
    t.success(sayfaD.id ? "Sayfa güncellendi" : "Sayfa oluşturuldu");
    setSayfaD(null); await yukle();
  }

  async function reklamKaydet() {
    if (!reklamD) return;
    const { error } = await sb.rpc("admin_ad_upsert", {
      p: {
        ...(reklamD.id ? { id: reklamD.id } : {}),
        placement: reklamD.placement, name: reklamD.name,
        advertiser: reklamD.advertiser || null,
        image_key: reklamD.image_key || null,
        target_url: reklamD.target_url || null,
        headline: reklamD.headline || null, body: reklamD.body || null,
        cta_label: reklamD.cta_label || null,
        locale: reklamD.locale || null, is_active: reklamD.is_active,
        starts_at: reklamD.starts_at || null, ends_at: reklamD.ends_at || null,
        sort_order: reklamD.sort_order,
      },
    });
    if (error) { t.error(error.message); return; }
    t.success(reklamD.id ? "Reklam güncellendi" : "Reklam eklendi");
    setReklamD(null); await yukle();
  }

  async function sil() {
    if (!silinecek) return;
    const rpc = silinecek.tur === "nav" ? "admin_nav_delete"
      : silinecek.tur === "sayfa" ? "admin_page_delete" : "admin_ad_delete";
    const { error } = await sb.rpc(rpc, { p_id: silinecek.id });
    setSilinecek(null);
    if (error) { t.error(error.message); return; }
    t.success("Silindi");
    await yukle();
  }

  async function acKapa(tur: "nav" | "reklam", id: string, acik: boolean) {
    const rpc = tur === "nav" ? "admin_nav_upsert" : "admin_ad_upsert";
    const { error } = await sb.rpc(rpc, { p: { id, is_active: acik } });
    if (error) { t.error(error.message); return; }
    await yukle();
  }

  /** Seçilen türe göre hedef listesi */
  const hedefler = navD?.kind === "category" ? categories
    : navD?.kind === "city" ? cities
    : navD?.kind === "page" ? sayfalar.map((s) => ({ slug: s.slug, name: s.display_title }))
    : [];

  if (yukleniyor) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={bolum}
        onChange={(k) => setBolum(k as typeof bolum)}
        items={[
          { key: "menu", label: "Menü", badge: navlar.length },
          { key: "sayfa", label: "Kurumsal sayfalar", badge: sayfalar.length },
          { key: "reklam", label: "Reklam alanları", badge: reklamlar.length },
        ]}
      />

      {/* ══════════ MENÜ ══════════ */}
      {bolum === "menu" && (
        <div className="kb-stagger flex flex-col gap-5">
          {navlar.some((n) => !n.target_ok) && (
            <Alert tone="danger" title="Kırık menü bağlantısı">
              Bazı öğelerin hedefi bulunamıyor — silinmiş bir kategori ya da
              sayfayı gösteriyor olabilir. Aşağıda kırmızı işaretli.
            </Alert>
          )}

          {YER.map((yer) => {
            const liste = navlar.filter((n) => n.location === yer);
            return (
              <Card key={yer} className="p-5">
                <CardHead
                  title={YER_ETIKET[yer]}
                  desc={`${liste.length} öğe`}
                  action={
                    <Button size="sm"
                      onClick={() => { setNavD({ ...BOS_NAV, location: yer }); setDil("tr"); }}>
                      <Icon name="plus" size={15} /> Ekle
                    </Button>
                  }
                />
                {liste.length === 0 ? (
                  <p className="text-[13px] text-muted2">Bu bölümde öğe yok.</p>
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Etiket</Th><Th>Tür</Th><Th>Hedef</Th>
                          <Th align="end">Sıra</Th><Th align="center">Açık</Th><Th align="end" />
                        </tr>
                      </thead>
                      <tbody>
                        {liste.map((n) => (
                          <tr key={n.id}>
                            <Td>
                              <span className="font-semibold">{n.display_label}</span>
                              <span className="mt-1 flex gap-1">
                                {DILLER.map((d) => (
                                  <Badge key={d} tone="muted"
                                    className={n.label?.[d] ? "" : "opacity-30"}>
                                    {d.toUpperCase()}
                                  </Badge>
                                ))}
                              </span>
                            </Td>
                            <Td className="text-muted">{TUR_ETIKET[n.kind] ?? n.kind}</Td>
                            <Td>
                              <code className="rounded bg-chip px-1.5 py-0.5 text-[12px]">
                                {n.target_slug ?? n.url ?? "—"}
                              </code>
                              {!n.target_ok && (
                                <Badge tone="danger" className="ms-2">bulunamadı</Badge>
                              )}
                            </Td>
                            <Td align="end" className="kb-num text-muted">{n.sort_order}</Td>
                            <Td align="center">
                              <div className="flex justify-center">
                                <Switch checked={n.is_active}
                                  onChange={(v) => acKapa("nav", n.id, v)}
                                  label={n.display_label} />
                              </div>
                            </Td>
                            <Td align="end">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setNavD({
                                    id: n.id, location: n.location, kind: n.kind,
                                    label: n.label ?? { tr: "" },
                                    target_slug: n.target_slug ?? "", url: n.url ?? "",
                                    sort_order: n.sort_order, is_active: n.is_active,
                                    open_new_tab: n.open_new_tab,
                                  });
                                  setDil("tr");
                                }}>
                                  <Icon name="edit" size={14} />
                                </Button>
                                <Button variant="ghost" size="sm"
                                  onClick={() => setSilinecek({ tur: "nav", id: n.id, ad: n.display_label })}>
                                  <Icon name="trash" size={14} />
                                </Button>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════════ SAYFALAR ══════════ */}
      {bolum === "sayfa" && (
        <Card className="p-5">
          <CardHead
            title="Kurumsal sayfalar"
            desc="Hakkımızda, künye, gizlilik… /sayfa/{adres} adresinden yayınlanır."
            action={
              <Button size="sm" onClick={() => { setSayfaD({ ...BOS_PAGE }); setDil("tr"); }}>
                <Icon name="plus" size={15} /> Sayfa ekle
              </Button>
            }
          />
          {sayfalar.length === 0 ? (
            <EmptyState title="Sayfa yok"
              description="Hakkımızda ya da gizlilik politikası gibi sayfalar burada tanımlanır." />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Başlık</Th><Th>Adres</Th><Th>Diller</Th>
                    <Th align="center">Menüde</Th><Th align="center">Açık</Th><Th align="end" />
                  </tr>
                </thead>
                <tbody>
                  {sayfalar.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-semibold">{s.display_title}</Td>
                      <Td><code className="rounded bg-chip px-1.5 py-0.5 text-[12px]">/{s.slug}</code></Td>
                      <Td>
                        <span className="flex gap-1">
                          {DILLER.map((d) => (
                            <Badge key={d} tone="muted"
                              className={s.filled_locales?.includes(d) ? "" : "opacity-30"}>
                              {d.toUpperCase()}
                            </Badge>
                          ))}
                        </span>
                      </Td>
                      <Td align="center">
                        {s.in_menu ? <Icon name="check" size={15} /> : <span className="text-muted2">—</span>}
                      </Td>
                      <Td align="center">
                        {s.is_active ? <Badge tone="green">Açık</Badge> : <Badge tone="muted">Kapalı</Badge>}
                      </Td>
                      <Td align="end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setSayfaD({
                              id: s.id, slug: s.slug,
                              title: s.title ?? { tr: "" }, body: s.body ?? { tr: "" },
                              is_active: s.is_active, sort_order: s.sort_order,
                            });
                            setDil("tr");
                          }}>
                            <Icon name="edit" size={14} />
                          </Button>
                          <Button variant="ghost" size="sm"
                            onClick={() => setSilinecek({ tur: "sayfa", id: s.id, ad: s.display_title })}>
                            <Icon name="trash" size={14} />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      )}

      {/* ══════════ REKLAM ══════════ */}
      {bolum === "reklam" && (
        <Card className="p-5">
          <CardHead
            title="Reklam alanları"
            desc="Site ayarlarındaki 'Reklamlar' anahtarı kapalıysa hiçbiri gösterilmez."
            action={
              <Button size="sm" onClick={() => setReklamD({ ...BOS_AD })}>
                <Icon name="plus" size={15} /> Reklam ekle
              </Button>
            }
          />
          {reklamlar.length === 0 ? (
            <EmptyState title="Reklam yok" />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Ad</Th><Th>Yerleşim</Th><Th align="end">Gösterim</Th>
                    <Th align="end">Tıklama</Th><Th align="end">CTR</Th>
                    <Th align="center">Yayında</Th><Th align="end" />
                  </tr>
                </thead>
                <tbody>
                  {reklamlar.map((a) => (
                    <tr key={a.id}>
                      <Td>
                        <span className="font-semibold">{a.name}</span>
                        {a.advertiser && (
                          <span className="mt-0.5 block text-[12px] text-muted">{a.advertiser}</span>
                        )}
                      </Td>
                      <Td className="text-muted">{YERLESIM_ETIKET[a.placement] ?? a.placement}</Td>
                      <Td align="end" className="kb-num text-muted">{a.impressions}</Td>
                      <Td align="end" className="kb-num text-muted">{a.clicks}</Td>
                      <Td align="end" className="kb-num text-muted">
                        {a.ctr_yuzde !== null ? `%${a.ctr_yuzde}` : "—"}
                      </Td>
                      <Td align="center">
                        {a.yayinda
                          ? <Badge tone="green">Yayında</Badge>
                          : <Badge tone="muted">{a.is_active ? "Tarih dışı" : "Kapalı"}</Badge>}
                      </Td>
                      <Td align="end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setReklamD({
                            id: a.id, placement: a.placement, name: a.name,
                            advertiser: a.advertiser ?? "", image_key: a.image_key ?? "",
                            target_url: a.target_url ?? "", headline: a.headline ?? "",
                            body: a.body ?? "", cta_label: a.cta_label ?? "",
                            locale: a.locale ?? "", is_active: a.is_active,
                            starts_at: a.starts_at?.slice(0, 16) ?? "",
                            ends_at: a.ends_at?.slice(0, 16) ?? "", sort_order: 100,
                          })}>
                            <Icon name="edit" size={14} />
                          </Button>
                          <Button variant="ghost" size="sm"
                            onClick={() => setSilinecek({ tur: "reklam", id: a.id, ad: a.name })}>
                            <Icon name="trash" size={14} />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      )}

      {/* ══════════ MENÜ POPUP ══════════ */}
      <Modal
        open={navD !== null} onClose={() => setNavD(null)}
        title={navD?.id ? "Menü öğesini düzenle" : "Menüye ekle"}
        wide
        footer={
          <div className="flex gap-2">
            <Button onClick={navKaydet}>Kaydet</Button>
            <Button variant="ghost" onClick={() => setNavD(null)}>Vazgeç</Button>
          </div>
        }
      >
        {navD && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bölüm">
                <Select value={navD.location}
                  onChange={(e) => setNavD({ ...navD, location: e.target.value })}>
                  {YER.map((y) => <option key={y} value={y}>{YER_ETIKET[y]}</option>)}
                </Select>
              </Field>
              <Field label="Tür">
                <Select value={navD.kind}
                  onChange={(e) => setNavD({ ...navD, kind: e.target.value, target_slug: "", url: "" })}>
                  {TUR.map((k) => <option key={k} value={k}>{TUR_ETIKET[k]}</option>)}
                </Select>
              </Field>

              {["category", "city", "page"].includes(navD.kind) && (
                <Field label="Hedef" hint="hedef gerçekten var mı kontrol edilir">
                  <Select value={navD.target_slug}
                    onChange={(e) => setNavD({ ...navD, target_slug: e.target.value })}>
                    <option value="">— seç —</option>
                    {hedefler.map((h) => (
                      <option key={h.slug} value={h.slug}>{h.name}</option>
                    ))}
                  </Select>
                </Field>
              )}
              {navD.kind === "url" && (
                <Field label="Adres">
                  <Input value={navD.url}
                    onChange={(e) => setNavD({ ...navD, url: e.target.value })}
                    placeholder="https://…" />
                </Field>
              )}
              <Field label="Sıra" hint="küçük olan önce">
                <Input type="number" value={navD.sort_order}
                  onChange={(e) => setNavD({ ...navD, sort_order: Number(e.target.value) })} />
              </Field>
            </div>

            <Divider />

            {/* Dört dilde etiket */}
            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink2">Etiket</span>
                <div className="ms-auto flex gap-1.5">
                  {DILLER.map((d) => (
                    <button key={d} type="button" onClick={() => setDil(d)}
                      className={`kb-lift rounded-full px-3 py-1 text-[12px] font-semibold ${
                        dil === d ? "bg-solid text-on-solid" : "bg-chip text-ink2"
                      } ${navD.label?.[d] ? "" : "opacity-60"}`}>
                      {d.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                value={navD.label?.[dil] ?? ""}
                onChange={(e) => setNavD({
                  ...navD, label: { ...navD.label, [dil]: e.target.value },
                })}
                placeholder={dil === "tr" ? "Spor" : "Boş bırakılırsa Türkçe gösterilir"}
              />
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2.5 text-[13.5px]">
                <Switch checked={navD.is_active}
                  onChange={(v) => setNavD({ ...navD, is_active: v })} label="Açık" />
                <span>Menüde görünsün</span>
              </label>
              <label className="flex items-center gap-2.5 text-[13.5px]">
                <Switch checked={navD.open_new_tab}
                  onChange={(v) => setNavD({ ...navD, open_new_tab: v })} label="Yeni sekme" />
                <span>Yeni sekmede aç</span>
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════ SAYFA POPUP ══════════ */}
      <Modal
        open={sayfaD !== null} onClose={() => setSayfaD(null)}
        title={sayfaD?.id ? "Sayfayı düzenle" : "Yeni sayfa"}
        wide
        footer={
          <div className="flex gap-2">
            <Button onClick={sayfaKaydet}>Kaydet</Button>
            <Button variant="ghost" onClick={() => setSayfaD(null)}>Vazgeç</Button>
          </div>
        }
      >
        {sayfaD && (
          <div className="flex flex-col gap-4">
            <Field
              label="Adres"
              hint={sayfaD.id ? "değiştirilemez — dış bağlantılar kırılır" : "küçük harf, tire"}
            >
              <Input value={sayfaD.slug} disabled={Boolean(sayfaD.id)}
                onChange={(e) => setSayfaD({ ...sayfaD, slug: e.target.value })}
                placeholder="hakkimizda" className="font-mono" />
            </Field>

            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink2">Dil</span>
              <div className="ms-auto flex gap-1.5">
                {DILLER.map((d) => (
                  <button key={d} type="button" onClick={() => setDil(d)}
                    className={`kb-lift rounded-full px-3 py-1 text-[12px] font-semibold ${
                      dil === d ? "bg-solid text-on-solid" : "bg-chip text-ink2"
                    } ${sayfaD.body?.[d] ? "" : "opacity-60"}`}>
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Başlık">
              <Input value={sayfaD.title?.[dil] ?? ""}
                onChange={(e) => setSayfaD({
                  ...sayfaD, title: { ...sayfaD.title, [dil]: e.target.value },
                })} />
            </Field>

            <Field label="Gövde" hint="markdown">
              <Textarea value={sayfaD.body?.[dil] ?? ""} className="min-h-[240px]"
                onChange={(e) => setSayfaD({
                  ...sayfaD, body: { ...sayfaD.body, [dil]: e.target.value },
                })} />
            </Field>

            <label className="flex items-center gap-2.5 text-[13.5px]">
              <Switch checked={sayfaD.is_active}
                onChange={(v) => setSayfaD({ ...sayfaD, is_active: v })} label="Yayında" />
              <span>Yayında</span>
            </label>
          </div>
        )}
      </Modal>

      {/* ══════════ REKLAM POPUP ══════════ */}
      <Modal
        open={reklamD !== null} onClose={() => setReklamD(null)}
        title={reklamD?.id ? "Reklamı düzenle" : "Yeni reklam"}
        wide
        footer={
          <div className="flex gap-2">
            <Button onClick={reklamKaydet}>Kaydet</Button>
            <Button variant="ghost" onClick={() => setReklamD(null)}>Vazgeç</Button>
          </div>
        }
      >
        {reklamD && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ad" hint="panelde görünür">
                <Input value={reklamD.name}
                  onChange={(e) => setReklamD({ ...reklamD, name: e.target.value })} />
              </Field>
              <Field label="Reklamveren">
                <Input value={reklamD.advertiser}
                  onChange={(e) => setReklamD({ ...reklamD, advertiser: e.target.value })} />
              </Field>
              <Field label="Yerleşim">
                <Select value={reklamD.placement}
                  onChange={(e) => setReklamD({ ...reklamD, placement: e.target.value })}>
                  {YERLESIM.map((y) => <option key={y} value={y}>{YERLESIM_ETIKET[y]}</option>)}
                </Select>
              </Field>
              <Field label="Dil" hint="boş = tüm diller">
                <Select value={reklamD.locale}
                  onChange={(e) => setReklamD({ ...reklamD, locale: e.target.value })}>
                  <option value="">Tüm diller</option>
                  {DILLER.map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                </Select>
              </Field>
              <Field label="Görsel anahtarı" hint="Medya kitaplığından URL kopyala">
                <Input value={reklamD.image_key} className="font-mono text-[13px]"
                  onChange={(e) => setReklamD({ ...reklamD, image_key: e.target.value })}
                  placeholder="library/…" />
              </Field>
              <Field label="Hedef adres" hint="https:// zorunlu">
                <Input value={reklamD.target_url}
                  onChange={(e) => setReklamD({ ...reklamD, target_url: e.target.value })}
                  placeholder="https://…" />
              </Field>
              <Field label="Başlangıç" hint="boş = hemen">
                <Input type="datetime-local" value={reklamD.starts_at}
                  onChange={(e) => setReklamD({ ...reklamD, starts_at: e.target.value })} />
              </Field>
              <Field label="Bitiş" hint="boş = süresiz">
                <Input type="datetime-local" value={reklamD.ends_at}
                  onChange={(e) => setReklamD({ ...reklamD, ends_at: e.target.value })} />
              </Field>
            </div>

            <Divider />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Başlık">
                <Input value={reklamD.headline}
                  onChange={(e) => setReklamD({ ...reklamD, headline: e.target.value })} />
              </Field>
              <Field label="Düğme metni">
                <Input value={reklamD.cta_label}
                  onChange={(e) => setReklamD({ ...reklamD, cta_label: e.target.value })} />
              </Field>
            </div>
            <Field label="Metin">
              <Textarea value={reklamD.body} className="min-h-[80px]"
                onChange={(e) => setReklamD({ ...reklamD, body: e.target.value })} />
            </Field>

            <label className="flex items-center gap-2.5 text-[13.5px]">
              <Switch checked={reklamD.is_active}
                onChange={(v) => setReklamD({ ...reklamD, is_active: v })} label="Aktif" />
              <span>Aktif</span>
            </label>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={silinecek !== null}
        onClose={() => setSilinecek(null)}
        title={`"${silinecek?.ad}" silinsin mi?`}
        description="Geri alınamaz."
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
