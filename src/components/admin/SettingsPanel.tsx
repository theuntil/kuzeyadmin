"use client";
import { useState } from "react";
import IstatistikSeridi from "./IstatistikSeridi";
import UygulamaGorselleri from "./UygulamaGorselleri";
import AyarPenceresi from "./AyarPenceresi";
import YoneticiGorselleri from "./YoneticiGorselleri";
import Icon from "@/components/ui/Icon";
import BrandPanel, { type Brand } from "./BrandPanel";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHead, SettingRow as Row, Switch, Divider } from "@/components/ui";

export interface Settings {
  site_name: string;
  site_tagline: string | null;
  maintenance_mode: boolean;
  maintenance_bypass_staff: boolean;
  maintenance_message: string | null;
  registration_enabled: boolean;
  registration_message: string | null;
  demo_mode: boolean;
  comments_enabled: boolean;
  comments_require_approval: boolean;
  likes_enabled: boolean;
  views_enabled: boolean;
  ai_summary_enabled: boolean;
  tts_enabled: boolean;
  weather_enabled: boolean;
  pharmacy_enabled: boolean;
  scores_enabled: boolean;
  traffic_enabled: boolean;
  earthquake_enabled: boolean;
  onthisday_enabled: boolean;
  yonetici_ad: string | null;
  yonetici_unvan: string | null;
  yonetici_slug: string | null;
  yonetici_foto_key: string | null;
  yonetici_kapak_key: string | null;
  yonetici_ozet: string | null;
  yonetici_biyografi: string | null;
  yonetici_linkedin: string | null;
  yonetici_x: string | null;
  yonetici_instagram: string | null;
  yonetici_email: string | null;
  yonetici_kart_acik: boolean;
  yonetici_sayfa_acik: boolean;
  prayer_enabled: boolean;
  markets_enabled: boolean;
  ads_enabled: boolean;
  ticker_enabled: boolean;
  city_strip_enabled: boolean;
  header_progress_bar: boolean;
  home_hero_count: number;
  home_featured_count: number;
  home_video_count: number;
  home_category_count: number;
  home_feed_count: number;
  home_mostread_count: number;
  /** Son dakika etiketi kaç gün gösterilsin — 0 = süresiz */
  son_dakika_gun: number;
  /** Uygulama mağazası adresleri — haber sayfasında düğme olur */
  app_store_url: string | null;
  play_store_url: string | null;
  app_gallery_url: string | null;
  app_store_badge_key: string | null;
  play_store_badge_key: string | null;
  app_gallery_badge_key: string | null;
  app_icon_key: string | null;
  app_name: string | null;
  app_tagline: string | null;
  /** Ekran görüntüleri — sıralı anahtar dizisi */
  app_screenshots: string[] | null;
  app_promo_enabled: boolean;
  /* Site genelindeki tanıtım bloğu — reels kartından bağımsız */
  app_promo_site_enabled: boolean;
  app_promo_key: string | null;
  app_promo_title: string | null;
  company_name: string | null;
  company_legal_name: string | null;
  company_owner: string | null;
  company_tax_office: string | null;
  company_tax_no: string | null;
  company_trade_no: string | null;
  company_story: string | null;
  imtiyaz_sahibi: string | null;
  genel_yayin_yonetmeni: string | null;
  sorumlu_yazi_isleri: string | null;
  yayin_turu: string | null;
  hosting_saglayici: string | null;
  yazilim_altyapisi: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  reklam_email: string | null;
  tekzip_email: string | null;
  sosyal_instagram: string | null;
  sosyal_facebook: string | null;
  sosyal_x: string | null;
  sosyal_youtube: string | null;
  sosyal_linkedin: string | null;
  sosyal_tiktok: string | null;
  sosyal_whatsapp: string | null;
  sosyal_telegram: string | null;
  /** App Store tarzı istatistik şeridi */
  app_stats: { ust: string; orta: string; alt: string }[] | null;
}

/**
 * SİTE AYARLARI
 *
 * Her değişiklik ANINDA kaydedilir; "Kaydet" düğmesi yok.
 * Otuz ayarı tek düğmeye bağlamak, kullanıcının hangisini
 * değiştirdiğini unutmasına ve yanlışlıkla hepsini
 * göndermesine yol açıyordu.
 *
 * Kaydetme başarısız olursa anahtar eski hâline döner.
 */
/* ══════════════════════════════════════════════════════════════
   SİTE AYARLARI

   ┌─ SEKMELİ ⚠️ ──────────────────────────────────────────────┐
   │ Beş bölüm alt alta dururken sayfa çok uzuyordu ve aranan   │
   │ ayarı bulmak için kaydırmak gerekiyordu. Sekmeler her      │
   │ bölümü kendi ekranına alıyor.                               │
   │                                                              │
   │ "Logo ve görünüm" ayrı bir menü maddesiydi; aynı tabloyu   │
   │ düzenlediği için buraya taşındı.                            │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

const BOLUMLER = [
  { k: "genel",    ad: "Genel",     ikon: "settings", desc: "Site adı ve slogan" },
  { k: "gorunum",  ad: "Görünüm",   ikon: "media",    desc: "Logo, favicon, paylaşım görseli" },
  { k: "erisim",   ad: "Erişim",    ikon: "users",    desc: "Bakım modu ve kayıtlar" },
  { k: "ozellik",  ad: "Özellikler", ikon: "check",   desc: "Yorum, beğeni, AI, hava durumu" },
  { k: "anasayfa", ad: "Ana sayfa", ikon: "home",     desc: "Bölüm başına haber sayısı" },
  { k: "kurumsal", ad: "Kurumsal",  ikon: "box",      desc: "Şirket bilgileri, künye, iletişim" },
  /*
   * ⚠ UYGULAMA AYARLARI DAĞINIKTI.
   * Mağaza adresleri "Genel"de, rozet görselleri orada, reklam
   * anahtarı "Özellikler"deydi. Aynı konudaki ayarları üç ayrı
   * sekmede aramak gerekiyordu; hepsi buraya toplandı.
   */
  { k: "uygulama", ad: "Mobil uygulama", ikon: "media", desc: "Mağaza adresleri, tanıtım kartı" },
] as const;

export default function SettingsPanel({
  initial, marka, cdnBase, acilisSekmesi,
}: {
  initial: Settings;
  marka: Brand;
  cdnBase: string;
  /** `/gorunum` adresinden gelindiyse o sekme açılıyor */
  acilisSekmesi?: string;
}) {
  const [bolum, setBolum] = useState<string>(acilisSekmesi ?? "genel");
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const t = useToast();

  async function save<K extends keyof Settings>(key: K, value: Settings[K]) {
    const prev = s[key];
    setS((p) => ({ ...p, [key]: value }));
    setBusy(String(key));

    const sb = supabaseBrowser();
    const { error } = await sb.rpc("admin_update_settings", {
      p_patch: { [key]: value },
    });
    setBusy(null);

    if (error) {
      setS((p) => ({ ...p, [key]: prev }));   // geri al
      t.error(error.message);
      return;
    }
    t.success("Kaydedildi");
  }

  const sw = (key: keyof Settings, label: string, desc?: string) => (
    <Row label={label} desc={desc}>
      <Switch
        checked={Boolean(s[key])}
        disabled={busy === key}
        label={label}
        onChange={(v) => save(key, v as Settings[typeof key])}
      />
    </Row>
  );

  /*
   * ⚠ ANINDA KAYDETME KALDIRILDI.
   *
   * Alanlar `onBlur` ile kaydediliyordu: yanlışlıkla bir rakama
   * dokunup başka yere tıklamak canlı siteyi değiştiriyordu ve
   * vazgeçme imkânı yoktu. Artık değere tıklayınca pencere
   * açılıyor, değişiklik orada yapılıp `Kaydet` ile onaylanıyor.
   */
  const num = (
    key: keyof Settings, label: string, desc?: string,
    opts?: { min?: number; max?: number; birim?: string },
  ) => (
    <Row label={label} desc={desc}>
      <button
        type="button"
        onClick={() => setDuzenle({
          key, label, aciklama: desc, tur: "sayi",
          min: opts?.min ?? 1, max: opts?.max ?? 50, birim: opts?.birim,
        })}
        disabled={busy === key}
        className="min-w-[84px] rounded-xl border border-line bg-surface2 px-3.5 py-2 text-[14px] font-semibold tabular-nums disabled:opacity-50"
      >
        {String(s[key] ?? "—")}{opts?.birim ? ` ${opts.birim}` : ""}
      </button>
    </Row>
  );

  const txt = (key: keyof Settings, label: string, desc?: string) => (
    <Row label={label} desc={desc}>
      <button
        type="button"
        onClick={() => setDuzenle({ key, label, aciklama: desc, tur: "metin" })}
        disabled={busy === key}
        className="max-w-[52vw] truncate rounded-xl border border-line bg-surface2 px-3.5 py-2 text-start text-[14px] disabled:opacity-50"
        style={{ minWidth: 240 }}
        title={String(s[key] ?? "")}
      >
        {String(s[key] ?? "").trim() || (
          <span className="text-muted2">Boş — eklemek için tıkla</span>
        )}
      </button>
    </Row>
  );

  /* Açık düzenleme penceresi — null ise kapalı */
  const [duzenle, setDuzenle] = useState<{
    key: keyof Settings;
    label: string;
    aciklama?: string;
    tur: "metin" | "sayi" | "uzunmetin";
    min?: number;
    max?: number;
    birim?: string;
  } | null>(null);

  const aktif = BOLUMLER.find((b) => b.k === bolum) ?? BOLUMLER[0];

  return (
    <div className="grid gap-5">
      {duzenle && (
        <AyarPenceresi
          acik
          onKapat={() => setDuzenle(null)}
          baslik={duzenle.label}
          aciklama={duzenle.aciklama}
          tur={duzenle.tur}
          deger={(s[duzenle.key] as string | number) ?? ""}
          min={duzenle.min}
          max={duzenle.max}
          birim={duzenle.birim}
          onKaydet={async (v: string | number) => {
            await save(duzenle.key, v as Settings[typeof duzenle.key]);
          }}
        />
      )}
      {/* ── Bölüm seçimi: ikonlu kartlar ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {BOLUMLER.map((b) => {
          const secili = b.k === bolum;
          return (
            <button
              key={b.k}
              type="button"
              onClick={() => setBolum(b.k)}
              className={`flex flex-col items-start gap-2 rounded-[16px] border-2 p-3.5 text-start transition-colors ${
                secili
                  ? "border-transparent bg-solid text-on-solid"
                  : "border-line2 hover:border-line"
              }`}
            >
              <Icon name={b.ikon as "settings"} size={19} />
              <span className="text-[13.5px] font-bold">{b.ad}</span>
              <span className={`text-[11.5px] leading-snug ${
                secili ? "opacity-80" : "text-muted2"
              }`}>
                {b.desc}
              </span>
            </button>
          );
        })}
      </div>

      {bolum === "genel" && (
        <Card className="p-5">
          <CardHead title="Genel" desc="Değişiklikler anında kaydedilir." />
          {txt("site_name", "Site adı")}
          {txt("site_tagline", "Slogan")}

        </Card>
      )}

      {bolum === "kurumsal" && (
        <Card className="p-5">
          <CardHead
            title="Kurumsal"
            desc="Buradaki bilgiler Hakkımızda, Künye ve iletişim sayfalarında kullanılır. Kodda sabit hiçbir bilgi yok."
          />

          <div className="kb-eyebrow mb-2">İletişim</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            Sitenin her yerinde ve mail servisinde bu bilgiler kullanılır.
          </p>
          {txt("contact_email", "Genel e-posta", "Sitenin her yerinde bu adres kullanılır.")}
          {txt("reklam_email", "Reklam e-postası", "Boş bırakırsan genel adres gösterilir.")}
          {txt("tekzip_email", "Tekzip e-postası", "Düzeltme ve cevap talepleri. Boşsa genel adres gösterilir.")}
          {txt("contact_phone", "Telefon")}
          {txt("contact_address", "Adres")}

          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Sosyal hesaplar</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            Tam adres yaz (https://instagram.com/hesabin). Doldurduğun
            hesaplar footer&apos;da, Hakkımızda ve İletişim sayfalarında
            otomatik görünür. Boş bıraktığın platform hiç çıkmaz.
          </p>
          {txt("sosyal_instagram", "Instagram")}
          {txt("sosyal_x", "X (Twitter)")}
          {txt("sosyal_facebook", "Facebook")}
          {txt("sosyal_youtube", "YouTube")}
          {txt("sosyal_tiktok", "TikTok")}
          {txt("sosyal_linkedin", "LinkedIn")}
          {txt("sosyal_whatsapp", "WhatsApp")}
          {txt("sosyal_telegram", "Telegram")}

          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Şirket</div>
          {txt("company_name", "Şirket adı", "Kısa ad — günlük kullanım")}
          {txt("company_legal_name", "Ticari unvan", "Resmi tam unvan")}
          {txt("company_owner", "Şirket sahibi")}
          {txt("company_tax_office", "Vergi dairesi")}
          {txt("company_tax_no", "Vergi numarası")}
          {txt("company_trade_no", "Ticaret sicil no")}

          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Künye</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            5187 sayılı Basın Kanunu gereği künye sayfasında
            gösterilmesi gereken bilgiler.
          </p>
          {txt("imtiyaz_sahibi", "İmtiyaz sahibi")}
          {txt("genel_yayin_yonetmeni", "Genel yayın yönetmeni")}
          {txt("sorumlu_yazi_isleri", "Sorumlu yazı işleri müdürü")}
          {txt("yayin_turu", "Yayın türü", "Örn. Yerel · İnternet haber sitesi")}

          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Teknik</div>
          {txt("yazilim_altyapisi", "Yazılım altyapısı")}
          {txt("hosting_saglayici", "Barındırma sağlayıcı")}

          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Yönetici tanıtımı</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            Hakkımızda sayfasında kişi kartı olarak görünür.
            Adres alanını doldurup sayfayı açarsan karta
            tıklanınca ayrıntı sayfasına gider.
          </p>
          {sw("yonetici_kart_acik", "Kart Hakkımızda'da görünsün")}
          {sw("yonetici_sayfa_acik", "Ayrıntı sayfası açık",
              "Kapalıysa kart tıklanamaz — 404 yerine bağlantısız durur.")}
          {txt("yonetici_ad", "Ad soyad")}
          {txt("yonetici_unvan", "Unvan", "Örn. Yönetim Kurulu Başkanı")}
          {txt("yonetici_slug", "Sayfa adresi",
               "Yalnızca küçük harf ve tire. Örn. hakan-coskun → /hakan-coskun")}
          {txt("yonetici_ozet", "Kısa tanıtım", "Sayfanın en üstünde tek paragraf")}
          {txt("yonetici_email", "E-posta")}
          {txt("yonetici_linkedin", "LinkedIn")}
          {txt("yonetici_x", "X (Twitter)")}
          {txt("yonetici_instagram", "Instagram")}

          <div className="mt-3">
            <span className="kb-eyebrow mb-1.5 block">Biyografi</span>
            <button
              type="button"
              onClick={() => setDuzenle({
                key: "yonetici_biyografi" as keyof Settings,
                label: "Biyografi",
                aciklama: "Ayrıntı sayfasında gösterilir. Paragrafları boş satırla ayır.",
                tur: "uzunmetin",
              })}
              className="w-full rounded-xl border border-line bg-surface2 p-3.5 text-start text-[13.5px] leading-relaxed"
            >
              {String(s.yonetici_biyografi ?? "").trim() || (
                <span className="text-muted2">Boş — yazmak için tıkla</span>
              )}
            </button>
          </div>

          <YoneticiGorselleri
            foto={s.yonetici_foto_key}
            kapak={s.yonetici_kapak_key}
            cdnBase={cdnBase}
            onDegisti={(alan, deger) => {
              setS((p2) => ({ ...p2, [alan]: deger }));
              void save(alan as keyof Settings, deger as never);
            }}
          />

          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Hikâyemiz</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            Hakkımızda sayfasında gösterilir. Paragrafları boş
            satırla ayır. Boş bırakırsan bölüm hiç çıkmaz.
          </p>
          {/* Diğer alanlarla aynı davranış: pencerede düzenlenip kaydediliyor */}
          <button
            type="button"
            onClick={() => setDuzenle({
              key: "company_story" as keyof Settings,
              label: "Hikâyemiz",
              aciklama: "Hakkımızda sayfasında gösterilir. Paragrafları boş satırla ayır.",
              tur: "uzunmetin",
            })}
            className="w-full rounded-xl border border-line bg-surface2 p-3.5 text-start text-[13.5px] leading-relaxed"
          >
            {String(s.company_story ?? "").trim() || (
              <span className="text-muted2">Boş — yazmak için tıkla</span>
            )}
          </button>
        </Card>
      )}

      {bolum === "uygulama" && (
        <Card className="p-5">
          <CardHead
            title="Mobil uygulama"
            desc="Mağaza adresleri, rozetler ve Reels akışındaki tanıtım kartı."
          />
          {sw("ads_enabled", "Sitede reklam alanları")}
          <Divider className="my-4" />
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            Haber sayfasında düğme olarak görünür. Android
            kullanıcısına yalnızca Google Play, iPhone
            kullanıcısına yalnızca App Store gösterilir.
            Boş bırakırsan düğme çıkmaz.
          </p>
          {txt("app_store_url", "App Store adresi")}
          {txt("play_store_url", "Google Play adresi")}
          {txt("app_gallery_url", "AppGallery adresi",
               "Huawei cihazlar için. Boşsa o düğme çıkmaz.")}

          <div className="mt-5 border-t border-line pt-5">
            <h3 className="mb-1 text-[13.5px] font-bold">Reels tanıtım kartı</h3>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
              Reels akışında her üç haberde bir gösterilen uygulama
              tanıtımı. Ekran görüntüleri ve simge burada ayarlanır.
            </p>

            {sw("app_promo_enabled", "Reels tanıtım kartı açık")}

            {/*
              ⚠ İKİ AYRI ANAHTAR.
              Üstteki reels akışındaki kartı, alttaki ana sayfa /
              haber / kurumsal sayfalardaki tanıtım bloğunu
              yönetiyor. Aynı anahtarı paylaşsalardı birini
              kapatmak ötekini de kapatırdı.
            */}
            {sw("app_promo_site_enabled", "Site tanıtım bloğu açık",
                "Ana sayfada öne çıkanların üstünde, haber sayfasında "
                + "yorumların üstünde ve kurumsal sayfaların altında.")}
            {txt("app_promo_title", "Blok başlığı",
                 "Satır sonu için \\n yazın. BOŞ BIRAKILIRSA başlık "
                 + "hiç gösterilmez, blok yalnızca mağaza kartlarıyla "
                 + "ortalanır.")}
            {txt("app_name", "Uygulama adı", "Örn. Kuzeybatı Haber")}
            {txt("app_tagline", "Kısa açıklama",
                 "Simgenin altında görünen tek satır")}

            <IstatistikSeridi
              satirlar={s.app_stats ?? []}
              onDegisti={(v) => {
                setS((p) => ({ ...p, app_stats: v }));
                void save("app_stats" as keyof Settings, v as never);
              }}
            />

            <UygulamaGorselleri
              simge={s.app_icon_key}
              blokGorsel={s.app_promo_key}
              ekranlar={s.app_screenshots ?? []}
              rozetler={{
                app_store_badge_key: s.app_store_badge_key,
                play_store_badge_key: s.play_store_badge_key,
                app_gallery_badge_key: s.app_gallery_badge_key,
              }}
              cdnBase={cdnBase}
              onDegisti={(alan, deger) => {
                setS((p) => ({ ...p, [alan]: deger }));
                void save(alan as keyof Settings, deger as never);
              }}
            />
          </div>
        </Card>
      )}

      {bolum === "gorunum" && (
        <BrandPanel initial={marka} cdnBase={cdnBase} />
      )}

      {bolum === "erisim" && (
        <Card className="p-5">
          <CardHead title="Erişim" />
          {sw("maintenance_bypass_staff", "Personel bakımı atlasın",
              "Açıkken editör ve yönetici bakım ekranını görmez, gerçek siteyi görür. Kapatma — bakım modunda kilitli kalabilirsin.")}
          {sw("maintenance_mode", "Bakım modu",
              "Açıkken siteye yalnızca yöneticiler girebilir.")}
          {txt("maintenance_message", "Bakım mesajı")}
          {sw("registration_enabled", "Yeni kayıtlar",
              "Kapalıyken kayıt sayfası kapanır; mevcut kullanıcılar girmeye devam eder.")}
          {txt("registration_message", "Kayıt kapalı mesajı")}
          {sw("demo_mode", "Demo içerik",
              "Veri yokken örnek haberler gösterilir. Yayında kapalı olmalı.")}
        </Card>
      )}

      {bolum === "ozellik" && (
        <Card className="p-5">
          <CardHead title="Özellikler" />
          {/*
            ⚠ REKLAM ANAHTARI BURADAN ALINDI.
            "Reklamlar" tek başına bir açma/kapama olarak
            duruyordu; reklamla ilgili diğer ayarlar başka
            sekmedeydi. Mobil uygulama bölümüne taşındı.
          */}
          {sw("comments_enabled", "Yorumlar")}
          {sw("comments_require_approval", "Yorumlar onaydan geçsin")}
          {sw("likes_enabled", "Beğeni")}
          {sw("views_enabled", "Görüntülenme sayacı")}
          {sw("ai_summary_enabled", "AI özeti")}
          {sw("tts_enabled", "Sesli anlatım")}
          <Divider className="my-4" />
          <div className="kb-eyebrow mb-2">Hizmetler</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
            Kapattığın hizmet menüde görünmez ve sayfası
            açılmaz. Adresi bilen biri de erişemez.
          </p>
          {sw("weather_enabled", "Hava durumu")}
          {sw("prayer_enabled", "Namaz vakitleri")}
          {sw("markets_enabled", "Piyasalar")}
          {sw("pharmacy_enabled", "Nöbetçi eczane")}
          {sw("scores_enabled", "Futbol skorları")}
          {sw("traffic_enabled", "Trafik durumu")}
          {sw("earthquake_enabled", "Deprem takip",
              "AFAD verisiyle son depremler. Yeni hizmet — varsayılan kapalı.")}
          {sw("onthisday_enabled", "Tarihte Bugün",
              "Wikipedia kaynaklı günün tarihî olayları. Hizmet sayfası, "
              + "ana sayfa ve haber sayfası widget'ı. Varsayılan kapalı.")}
          {sw("ticker_enabled", "Piyasa şeridi")}
          {sw("city_strip_enabled", "Şehir şeridi")}
          {sw("header_progress_bar", "Okuma çubuğu")}
        </Card>
      )}

      {bolum === "anasayfa" && (
        <Card className="p-5">
          <CardHead title="Ana sayfa" desc="Her bölümde kaç haber gösterilecek." />
          {num("home_hero_count", "Manşet")}
          {num("home_featured_count", "Öne çıkanlar")}
          {num("home_video_count", "Video rayı")}
          {num("home_category_count", "Kategori başına")}
          {num("home_feed_count", "Akış")}
          {num("home_mostread_count", "En çok okunanlar")}
          {num("son_dakika_gun", "Son dakika kaç gün",
               "Bu süreden eski haberlerde etiket kendiliğinden kalkar. 0 = süresiz.")}
        </Card>
      )}

      <p className="px-1 text-[12px] text-muted2">{aktif.desc}</p>
    </div>
  );
}
