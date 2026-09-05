import type { Metadata } from "next";
import HaberListe from "@/components/admin/HaberListe";
import HaberDetay from "@/components/admin/HaberDetay";
import HaberDuzenle from "@/components/admin/HaberDuzenle";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import {
  Card, Panel, PageHead, EmptyState, Badge, Eyebrow, StatBlock, Button,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";
import { n } from "@/lib/utils";

import OnayKuyrugu from "@/components/admin/OnayKuyrugu";
import YazarlarPanel from "@/components/admin/YazarlarPanel";
import PolitikaPanel from "@/components/admin/PolitikaPanel";
import CommentQueue, { type Yorum } from "@/components/admin/CommentQueue";
import UserTable, { type UserRow } from "@/components/admin/UserTable";
import MediaLibrary, { type LibItem } from "@/components/admin/MediaLibrary";
import SettingsPanel, { type Settings } from "@/components/admin/SettingsPanel";
import BrandPanel, { type Brand } from "@/components/admin/BrandPanel";
import BotSettingsPanel, { type BotSettings } from "@/components/admin/BotSettingsPanel";
import AiSettingsPanel, { type AiSettings, type AiHealth } from "@/components/admin/AiSettingsPanel";
import PromptPanel from "@/components/admin/PromptPanel";
import MappingPanel, { type Secenek } from "@/components/admin/MappingPanel";
import ContentPanel from "@/components/admin/ContentPanel";
import StatsPanel from "@/components/admin/StatsPanel";
import SourcesPanel from "@/components/admin/SourcesPanel";
import TaksonomiPanel from "@/components/admin/TaksonomiPanel";
import ActivityPanel, { type ActivityRow } from "@/components/admin/ActivityPanel";
import Link from "next/link";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } };
}

/** Menüdeki adres → bölüm anahtarı */
const SECTIONS = {
  "": "overview",
  "istatistik": "stats",
  "haberler": "articles",
  "onay": "queue",
  "yorumlar": "comments",
  "medya": "media",
  "kullanici": "users",
  "yazarlar": "authors",
  "politikalar": "policies",
  "ayarlar": "settings",
  "gorunum": "brand",
  "bot": "bot",
  "ai": "ai",
  "eslestirme": "mapping",
  "prompt": "prompt",
  "icerik": "icerik",
  "kayitlar": "activity",
  "kaynaklar": "sources",
  "kategoriler": "categories",
} as const;

type Section = (typeof SECTIONS)[keyof typeof SECTIONS];

type Section2 = Section | "bot" | "ai" | "mapping" | "prompt" | "icerik" | "authors" | "policies";
const ADMIN_ONLY: string[] = ["users", "authors", "policies", "mail", "settings", "brand", "bot", "ai", "mapping", "prompt", "icerik", "activity", "sources", "categories"];

export default async function AdminPage({
  params, searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const [{ section }, q] = await Promise.all([params, searchParams]);
  const slug = section?.[0] ?? "";

  const key = SECTIONS[slug as keyof typeof SECTIONS];
  if (!key) notFound();

  const { sb, role, profile, userId } = await requireAdmin(ADMIN_ONLY.includes(key));
  const cfg = getConfig();
  const isAdmin = role === "admin";

  /* Menü rozetleri: bekleyen haber ve yorum sayısı */
  const [{ data: ov }, { data: st }] = await Promise.all([
    sb.from("admin_overview").select("*").maybeSingle(),
    sb.from("public_site_settings").select("logo_dark_key, logo_light_key").maybeSingle(),
  ]);

  const logoKey = (st?.logo_dark_key ?? st?.logo_light_key) as string | null;
  const logoDark = logoKey
    ? `${cfg.cdnBase.replace(/\/+$/, "")}/${logoKey}`
    : null;

  /*
   * Kabuk artık LAYOUT'ta (`(panel)/layout.tsx`). Burada yalnızca
   * içerik döndürülüyor; menü sayfa geçişlerinde yerinde kalıyor.
   */
  const shell = (children: React.ReactNode) => children;


  /* ---------------- GÖSTERGE PANELİ ---------------- */
  if (key === "overview") {
    /** İş bekleyen kartlar üstte: panele girince ilk görülmesi gereken bu */
    const pending = [
      { label: "Onay bekleyen haber", v: Number(ov?.bekleyen_haber ?? 0),
        icon: "news" as const, href: "/onay" },
      { label: "Onay bekleyen yorum", v: Number(ov?.bekleyen_yorum ?? 0),
        icon: "comment" as const, href: "/yorumlar" },
      { label: "Bekleyen eşleştirme",
        v: Number(ov?.bekleyen_kategori ?? 0) + Number(ov?.bekleyen_sehir ?? 0),
        icon: "settings" as const },
      { label: "Hatalı medya", v: Number(ov?.hatali_medya ?? 0),
        icon: "warn" as const, danger: true },
    ];

    const stats = [
      { label: "Yayındaki haber", v: Number(ov?.yayindaki_haber ?? 0) },
      { label: "Bugün yayınlanan", v: Number(ov?.bugun_yayin ?? 0) },
      { label: "Son 24 saat okuma", v: Number(ov?.okuma_24s ?? 0) },
      { label: "Toplam okuma", v: Number(ov?.toplam_okuma ?? 0) },
      { label: "Kullanıcı", v: Number(ov?.kullanici ?? 0) },
      { label: "Yeni kullanıcı (7 gün)", v: Number(ov?.yeni_kullanici ?? 0) },
      { label: "Bülten abonesi", v: Number(ov?.bulten_abone ?? 0) },
      { label: "Yorum", v: Number(ov?.toplam_yorum ?? 0) },
    ];

    return shell(
      <>
        <PageHead
          eyebrow="Gösterge paneli"
          title={`Merhaba ${String(profile?.display_name ?? "").split(" ")[0]}`}
          desc="Sitenin genel durumu ve bekleyen işler."
        />

        <div className="ct-stagger mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pending.map((c) => {
            const inner = (
              <Card className="h-full p-5 transition-colors hover:border-ink/20">
                <div className="flex items-center gap-2 text-muted">
                  <Icon name={c.icon} size={15} />
                  <span className="text-[12.5px] font-semibold">{c.label}</span>
                </div>
                <div className="mt-3 flex items-end gap-2.5">
                  <span className="font-display text-[34px] font-semibold leading-none tracking-[-.03em]">
                    {n(c.v)}
                  </span>
                  {c.v > 0 && (
                    <Badge tone={c.danger ? "danger" : "orange"}>
                      {c.danger ? "dikkat" : "bekliyor"}
                    </Badge>
                  )}
                </div>
              </Card>
            );
            return c.href
              ? <Link key={c.label} href={c.href} className="block">{inner}</Link>
              : <div key={c.label}>{inner}</div>;
          })}
        </div>

        <Panel className="p-6 sm:p-8">
          <Eyebrow className="mb-5 block">Özet</Eyebrow>
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((x) => (
              <StatBlock key={x.label} value={n(x.v)} label={x.label} />
            ))}
          </div>
        </Panel>
      </>,
    );
  }

  /* ---------------- HABERLER ---------------- */
  /* ---------------- HABERLER ---------------- */
  /* ---------------- ONAY KUYRUĞU ---------------- */
  /* ---------------- POLİTİKALAR ---------------- */
  if (key === "policies") {
    return shell(
      <>
        <PageHead
          title="Politikalar"
          desc="Gizlilik, kullanım şartları gibi yasal metinler. Sürümlü ve onay takipli."
        />
        <PolitikaPanel />
      </>,
    );
  }

  /* ---------------- YAZARLAR ---------------- */
  if (key === "authors") {
    return shell(
      <>
        <PageHead
          title="Yazarlar"
          desc="Yazar kadrosu ve yayın istatistikleri. Yazarlarımız sayfasında kimin görüneceğini buradan seçiyorsun."
        />
        <YazarlarPanel cdn={cfg.cdnBase} />
      </>,
    );
  }

  if (key === "queue") {
    /*
     * ⚠ VERİ İSTEMCİDE ÇEKİLİYOR.
     * Onay/red sonrası liste anında güncellenmeli; sunucuda
     * çekilseydi her işlemden sonra tam sayfa yenilenirdi.
     */
    return shell(
      <>
        <PageHead
          title="Onay bekleyenler"
          desc="Yazarların gönderdiği haberler. Onayladığında yayına girer."
        />
        <OnayKuyrugu cdn={cfg.cdnBase} siteUrl={cfg.siteUrl} canApprove={isAdmin} />
      </>,
    );
  }

  if (key === "articles") {
    /*
     * ⚠ ÜÇ EKRAN TEK ROTADA.
     *   /haberler              → liste
     *   /haberler/yeni         → yeni haber
     *   /haberler/{id}         → detay
     *   /haberler/{id}/duzenle → düzenleme
     *
     * Alt yol ikinci parçadan okunuyor. Ayrı dosyalar açmak
     * yerine burada dallanmak, panel kabuğunun (menü, başlık)
     * tek yerde kalmasını sağlıyor.
     */
    const alt = section?.[1] ?? "";
    const ucuncu = section?.[2] ?? "";

    if (alt === "yeni") {
      return shell(
        <>
          <PageHead title="Yeni haber"
            desc="Kaynak varsayılan olarak Kuzeybatı seçili gelir." />
          <HaberDuzenle id={null} cdnBase={cfg.cdnBase} />
        </>,
      );
    }

    if (alt && ucuncu === "duzenle") {
      return shell(
        <>
          <PageHead title="Haberi düzenle" desc="Değişiklikler kaydedilene kadar uygulanmaz." />
          <HaberDuzenle id={alt} cdnBase={cfg.cdnBase} />
        </>,
      );
    }

    if (alt) {
      return shell(
        <>
          <PageHead title="Haber" desc="İstatistikler, medya ve yorumlar." />
          <HaberDetay id={alt} cdnBase={cfg.cdnBase} siteUrl={cfg.siteUrl} canApprove={isAdmin} />
        </>,
      );
    }

    return shell(
      <>
        <PageHead title="Haberler" desc="Tüm haberler. Ara, süz, düzenle." />
        <HaberListe cdnBase={cfg.cdnBase} />
      </>,
    );
  }

  if (key === "comments") {
    /* Varsayılan TÜM yorumlar; sekme istemcide değişiyor */
    const { data } = await sb
      .from("admin_comments").select("*")
      .order("created_at", { ascending: false }).limit(200);
    return shell(
      <>
        <PageHead title="Yorumlar"
          desc="Tüm yorumlar, en yeni üstte. Yazara tıklayarak profiline gidebilirsin." />
        <CommentQueue
          initial={(data ?? []) as unknown as Yorum[]}
          cdnBase={cfg.cdnBase}
          siteUrl={cfg.siteUrl}
        />
      </>,
    );
  }


  /* ---------------- MEDYA ---------------- */
  if (key === "media") {
    const { data } = await sb
      .from("library_media").select("*")
      .order("created_at", { ascending: false }).limit(200);

    return shell(
      <>
        <PageHead title="Medya" desc="Sitede kullanabileceğin görseller." />
        <MediaLibrary
          items={(data ?? []) as unknown as LibItem[]}
          cdnBase={cfg.cdnBase}
        />
      </>,
    );
  }

  /* ---------------- KULLANICILAR ---------------- */
  if (key === "users") {
    const { data } = await sb
      .from("admin_users").select("*")
      .order("created_at", { ascending: false }).limit(200);

    return shell(
      <>
        <PageHead title="Kullanıcılar"
          desc="Bir kullanıcıya tıklayarak bilgilerini, yorumlarını ve hesap işlemlerini aç." />
        <UserTable users={(data ?? []) as unknown as UserRow[]} cdnBase={cfg.cdnBase} />
      </>,
    );
  }

  /* ---------------- İSTATİSTİK ---------------- */
  if (key === "stats") {
    return shell(
      <>
        <PageHead title="İstatistikler"
          desc="Okunma, ziyaretçi, cihaz ve trafik kaynakları." />
        <StatsPanel siteUrl={cfg.siteUrl} />
      </>,
    );
  }


  /*
   * MAİL artık `/mail` altında ayrı sayfalarda:
   *   /mail            liste (?kutu= ile sekme, ?ayar=1 ile ayarlar)
   *   /mail/yeni       yeni mail
   *   /mail/{id}       detay
   *
   * Catch-all rota `/mail`i yakalamaz çünkü daha spesifik bir
   * segment her zaman önceliklidir.
   */

  /* ---------------- SİTE AYARLARI ---------------- */
  if (key === "settings" || key === "brand") {
    /*
     * ⚠ GÖRÜNÜM AYARLARIN İÇİNE ALINDI.
     * "Site ayarları" ve "Logo ve görünüm" ayrı menü
     * maddeleriydi; ikisi de aynı tabloyu düzenliyordu ve
     * kullanıcı hangisinde ne olduğunu hatırlamak zorunda
     * kalıyordu. Artık tek sayfa, sekmeli.
     *
     * `/gorunum` adresi çalışmaya devam ediyor — eski
     * yer imleri kırılmasın diye.
     */
    const { data } = await sb.from("site_settings").select("*").maybeSingle();
    const s = data as unknown as (Settings & Brand) | null;

    return shell(
      <>
        <PageHead title="Site ayarları" desc="Değişiklikler anında kaydedilir." />
        <SettingsPanel
          initial={s as unknown as Settings}
          marka={(s as unknown as Brand) ?? {
            logo_light_key: null, logo_dark_key: null,
            favicon_key: null, favicon_dark_key: null, og_image_key: null,
          }}
          cdnBase={cfg.cdnBase}
          acilisSekmesi={key === "brand" ? "gorunum" : undefined}
        />
      </>,
    );
  }

  /* ---------------- İHA BOTU ---------------- */
  if (key === "bot") {
    const { data } = await sb.from("bot_settings").select("*").maybeSingle();
    return shell(
      <>
        <PageHead eyebrow="Sistem" title="İHA botu" desc="Haber akışının çekilme ve işlenme kuralları." />
        <BotSettingsPanel initial={data as unknown as BotSettings} />
      </>,
    );
  }

  /* ---------------- AI SERVİSİ ---------------- */
  if (key === "ai") {
    const [set, health] = await Promise.all([
      sb.from("ai_settings").select("*").maybeSingle(),
      sb.from("ai_health").select("*").maybeSingle(),
    ]);
    return shell(
      <>
        <PageHead eyebrow="Sistem" title="AI servisi" desc="Analiz, çeviri ve bütçe ayarları." />
        <AiSettingsPanel
          initial={set.data as unknown as AiSettings}
          health={(health.data as unknown as AiHealth) ?? null}
        />
      </>,
    );
  }

  /* ---------------- AI PROMPT VE ÇIKTI ŞEMASI ---------------- */
  if (key === "prompt") {
    return shell(
      <>
        <PageHead
          eyebrow="Sistem"
          title="Prompt ve çıktı şeması"
          desc="Modele ne söylediğimiz ve ne döndürmesini istediğimiz."
        />
        <PromptPanel />
      </>,
    );
  }

  /* ---------------- SİTE İÇERİĞİ (menü · sayfa · reklam) ---------------- */
  if (key === "icerik") {
    const [cats, cits] = await Promise.all([
      sb.from("categories").select("slug, name").eq("is_active", true).order("sort_order"),
      sb.from("cities").select("slug, name").eq("is_active", true).order("name").limit(100),
    ]);
    return shell(
      <>
        <PageHead eyebrow="Sistem" title="Site içeriği"
          desc="Menü, kurumsal sayfalar ve reklam alanları." />
        <ContentPanel
          categories={(cats.data ?? []) as { slug: string; name: string }[]}
          cities={(cits.data ?? []) as { slug: string; name: string }[]}
        />
      </>,
    );
  }

  /* ---------------- HABER KAYNAKLARI ---------------- */
  if (key === "sources") {
    return shell(
      <>
        <PageHead eyebrow="Sistem" title="Haber kaynakları"
          desc="Ajans adı, logosu ve haber altındaki etiket." />
        <SourcesPanel cdnBase={cfg.cdnBase} />
      </>,
    );
  }



  /* ---------------- DENETİM İZİ ---------------- */
  if (key === "activity") {
    const { data } = await sb
      .from("admin_activity").select("*")
      .order("created_at", { ascending: false }).limit(200);
    return shell(
      <>
        <PageHead eyebrow="Sistem" title="Kayıtlar"
          desc="Kim ne zaman ne değiştirdi. Kayıtlar silinemez." />
        <ActivityPanel rows={(data ?? []) as unknown as ActivityRow[]} />
      </>,
    );
  }

  /* ---------------- KATEGORİ / ŞEHİR EŞLEŞTİRME ---------------- */
  if (key === "mapping" || key === "categories") {
    /*
     * ⚠ KATEGORİLER VE EŞLEŞTİRME TEK SAYFA.
     * Menüde iki ayrı öğe olarak durunca hangisinin ne yaptığı
     * anlaşılmıyordu. Artık tek sayfa, iki sekme.
     *
     * Seçenekler sunucudan geliyor: nadiren değişiyorlar ve
     * her sekme değişiminde yeniden çekmenin anlamı yok.
     * Listeler istemcide çekiliyor.
     */
    const [catOpts, cityOpts, bekleyen] = await Promise.all([
      sb.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
      sb.from("cities").select("id, name").eq("is_active", true).order("name"),
      sb.from("admin_mapping_stats").select("bekleyen_kategori, bekleyen_sehir").maybeSingle(),
    ]);

    const b = bekleyen.data as
      { bekleyen_kategori: number; bekleyen_sehir: number } | null;

    return shell(
      <>
        <PageHead eyebrow="İçerik" title="Kategoriler"
          desc="Kategorileri yönet, ajanstan gelen ham adları onlara bağla." />
        <TaksonomiPanel
          catOptions={(catOpts.data ?? []) as Secenek[]}
          cityOptions={(cityOpts.data ?? []) as Secenek[]}
          bekleyen={(b?.bekleyen_kategori ?? 0) + (b?.bekleyen_sehir ?? 0)}
        />
      </>,
    );
  }



}
