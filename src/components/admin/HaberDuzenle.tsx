"use client";
import { useState, useCallback, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  Button, Card, Field, Input, Textarea, Select, Switch, Badge,
  EmptyState, Skeleton, Divider,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";
import SehirSec from "./SehirSec";
import KunyeSec from "./KunyeSec";
import KategoriSec from "./KategoriSec";
import MedyaGaleri from "./MedyaGaleri";
import { medyaOnizleme } from "@/lib/medya-adres";

/* ══════════════════════════════════════════════════════════════
   HABER DÜZENLEME

   ┌─ SEKMELİ, TEK EKRAN DEĞİL ⚠️ ─────────────────────────────┐
   │ Bir haberde 30'dan fazla düzenlenebilir alan var: başlık,  │
   │ gövde, medya, kategori, etiket, dört dil sürümü, AI        │
   │ çıktısı… Hepsi tek sayfada olsaydı kullanılamazdı.         │
   │                                                              │
   │ Beş sekme: İçerik · Medya · Sınıflandırma · Diller · AI    │
   │ Günlük iş ilk sekmede; diğerleri gerektiğinde.             │
   └──────────────────────────────────────────────────────────────┘

   ┌─ KAYDEDİLMEMİŞ DEĞİŞİKLİK UYARISI ⚠️ ─────────────────────┐
   │ Sekme değiştirmek veriyi KAYBETMİYOR — hepsi tek durumda   │
   │ tutuluyor ve tek "Kaydet" ile gidiyor. Ama sayfadan        │
   │ çıkarken uyarı veriliyor.                                    │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

type Blok = { type: string; text?: string; level?: number };

interface Form {
  id: string;
  title: string;
  summary: string;
  body: Blok[];
  status: string;
  son_dakika: boolean;
  published_at: string;
  category_id: string;
  city_id: string;
  source_id: string;
  tags: string[];
  cover_media_id: string;
  byline: string;
  slug: string;
  author_id: string;
}

interface Medya {
  id: string; type: string; status: string;
  storage_key: string | null; poster_key: string | null;
  caption: string | null; credit: string | null;
  sort_order: number; duration_sec: number | null;
  /* Galeride boyut gösteriliyor */
  width: number | null; height: number | null;
  /* Adres kurulumu için: panel medyası `direct` işareti taşıyor */
  variants?: Record<string, unknown> | null;
}

interface Ceviri {
  locale: string; baslik: string; ozet: string; icerik: string; status: string;
}

interface Ai {
  ozet: string; instagram: string;
  onem_puani: string; onem_gerekce: string;
  cocuk_guvenli: boolean | null; guvenlik_sebepleri: string[];
}

/*
 * ⚠ "SINIFLANDIRMA" SEKMESİ KALDIRILDI.
 * Kategori, şehir ve künye her haberde doldurulan alanlar;
 * ayrı bir sekmede saklamak her seferinde bir tıklama
 * daha demekti. İçerik sekmesinin üstüne taşındılar.
 */
const SEKMELER = [
  { k: "icerik", ad: "İçerik", ikon: "news" },
  { k: "medya", ad: "Medya", ikon: "media" },
  { k: "dil", ad: "Diller", ikon: "system" },
  { k: "ai", ad: "AI", ikon: "settings" },
] as const;

const DILLER = [
  { k: "en", ad: "İngilizce", bayrak: "🇬🇧" },
  { k: "ar", ad: "Arapça",    bayrak: "🇸🇦" },
  { k: "ru", ad: "Rusça",     bayrak: "🇷🇺" },
];

/*
 * Durumlar ikonlu kutu olarak gösteriliyor, açılır liste değil.
 * Dört seçenek var; hepsini birden görmek tek tıkla seçmeyi
 * sağlıyor ve hangi durumda olduğu ilk bakışta anlaşılıyor.
 */
/*
 * ⚠ `v` DEĞERLERİ `article_status` ENUM'UYLA BİREBİR.
 * "review" yazıyordu; enum'da öyle bir değer yok, kaydetme
 * sessizce başarısız oluyordu. Doğrusu "pending_review".
 */
const DURUMLAR = [
  { v: "published",      ad: "Yayında",       ikon: "check", renk: "#16a34a" },
  { v: "draft",          ad: "Taslak",        ikon: "edit",  renk: "#64748b" },
  { v: "pending_review", ad: "Onay bekliyor", ikon: "clock", renk: "#d97706" },
  { v: "rejected",       ad: "Reddedildi",    ikon: "close", renk: "#dc2626" },
  { v: "archived",       ad: "Arşiv",         ikon: "box",   renk: "#64748b" },
] as const;

/* Çocuk güvenliği — üç kart */
const COCUK = [
  { v: null,  ad: "Değerlendirilmedi", aciklama: "AI henüz bakmadı", renk: "#64748b" },
  { v: true,  ad: "Uygun",             aciklama: "Çocuklar görebilir", renk: "#16a34a" },
  { v: false, ad: "Uygun değil",       aciklama: "Çocuk modunda örtülür", renk: "#be1e2d" },
] as const;

export default function HaberDuzenle({
  id, cdnBase,
}: {
  /** Boşsa yeni haber */
  id: string | null;
  cdnBase: string;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [sekme, setSekme] = useState<string>("icerik");
  const [yukleniyor, setYukleniyor] = useState(Boolean(id));
  const [kaydediyor, setKaydediyor] = useState(false);
  const [degisti, setDegisti] = useState(false);

  const [f, setF] = useState<Form>({
    id: "", title: "", summary: "", body: [],
    status: id ? "draft" : "published",
    /* Yeni haber doğrudan yayına giriyor — panelden ekleyen yetkili */
    son_dakika: false, published_at: "", category_id: "", city_id: "",
    source_id: "", tags: [], cover_media_id: "", byline: "", slug: "",
    author_id: "",
  });
  const [medya, setMedya] = useState<Medya[]>([]);
  const [ceviriler, setCeviriler] = useState<Ceviri[]>([]);
  const [ai, setAi] = useState<Ai>({
    ozet: "", instagram: "", onem_puani: "", onem_gerekce: "",
    cocuk_guvenli: null, guvenlik_sebepleri: [],
  });

  const [kategoriler, setKategoriler] = useState<{ id: string; name: string }[]>([]);
  const [kaynaklar, setKaynaklar] = useState<{ id: string; short_name: string; slug: string }[]>([]);
  const [yukluyor, setYukluyor] = useState(false);
  const [silinecekMedya, setSilinecekMedya] = useState<Medya | null>(null);
  /** Tam ekran galeride açık olan medyanın sırası */
  const [galeri, setGaleri] = useState<number | null>(null);
  /** Diller sekmesinde hangi dil düzenleniyor */
  const [aktifDil, setAktifDil] = useState("en");
  const [slugTaslak, setSlugTaslak] = useState("");
  const [slugDurum, setSlugDurum] = useState<
    { uygun: boolean; sebep?: string; onerilen?: string } | null>(null);
  const [slugKaydediyor, setSlugKaydediyor] = useState(false);
  const [etiketGirdi, setEtiketGirdi] = useState("");

  /** Seçenekleri bir kez çek */
  useEffect(() => {
    void (async () => {
      /* Şehirler ayrı: SehirSec kendi listesini çekiyor */
      const [k, s] = await Promise.all([
        sb.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
        sb.from("admin_sources").select("id, short_name, slug").order("sort_order"),
      ]);
      setKategoriler((k.data ?? []) as { id: string; name: string }[]);
      const kl = (s.data ?? []) as { id: string; short_name: string; slug: string }[];
      setKaynaklar(kl);

      /*
       * ⚠ YENİ HABERDE VARSAYILAN KAYNAK: KUZEYBATI.
       * Panelden eklenen haber bize ait; her seferinde kaynak
       * seçtirmek gereksiz bir adım.
       */
      if (!id) {
        const kb = kl.find((x) => x.slug === "kuzeybati");
        if (kb) setF((p) => ({ ...p, source_id: kb.id }));
      }
    })();
  }, [sb, id]);

  const yukle = useCallback(async () => {
    if (!id) return;
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_haber_detay", { p_id: id });
    setYukleniyor(false);
    if (error) { t.error(error.message); return; }

    const v = data as {
      haber: Record<string, unknown>;
      medya: Medya[];
      ceviriler: { locale: string; baslik: string | null; ozet: string | null;
                   icerik: string | null; status: string }[];
      ai: Record<string, unknown> | null;
    };
    const h = v.haber;

    setF({
      id: String(h.id),
      title: String(h.title ?? ""),
      summary: String(h.summary ?? ""),
      body: (h.body as Blok[]) ?? [],
      status: String(h.status ?? "draft"),
      son_dakika: Boolean(h.son_dakika),
      // datetime-local biçimi: saniye ve saat dilimi olmadan
      published_at: h.published_at
        ? new Date(String(h.published_at)).toISOString().slice(0, 16)
        : "",
      category_id: String(h.category_id ?? ""),
      city_id: String(h.city_id ?? ""),
      source_id: String(h.source_id ?? ""),
      tags: (h.tags as string[]) ?? [],
      cover_media_id: String(h.cover_media_id ?? ""),
      byline: String(h.byline ?? ""),
      slug: String(h.slug ?? ""),
      author_id: String(h.author_id ?? ""),
    });
    setSlugTaslak(String(h.slug ?? ""));
    setMedya(v.medya ?? []);
    setCeviriler((v.ceviriler ?? []).map((c) => ({
      locale: c.locale, baslik: c.baslik ?? "", ozet: c.ozet ?? "",
      icerik: c.icerik ?? "", status: c.status,
    })));
    if (v.ai) {
      setAi({
        ozet: String(v.ai.ozet ?? ""),
        instagram: String(v.ai.instagram ?? ""),
        onem_puani: v.ai.onem_puani ? String(v.ai.onem_puani) : "",
        onem_gerekce: String(v.ai.onem_gerekce ?? ""),
        cocuk_guvenli: v.ai.cocuk_guvenli as boolean | null,
        guvenlik_sebepleri: (v.ai.guvenlik_sebepleri as string[]) ?? [],
      });
    }
    setDegisti(false);
  }, [sb, t, id]);

  useEffect(() => { void yukle(); }, [yukle]);

  /*
   * ⚠ SESSİZ TASLAK.
   *
   * Medya `news/.../{haber_id}/` klasörüne gidiyor; bunun için
   * haberin kimliği gerekiyor. Önce "haberi kaydet, sonra medya
   * ekle" diyordum — kullanıcı başlığı yazıp medyayı sürükleyip
   * tek seferde bitirmek istiyor.
   *
   * Artık ekran açılır açılmaz arka planda boş bir taslak
   * açılıyor. Kullanıcı bunu görmüyor; medya, slug ve etiketler
   * doğrudan çalışıyor. Vazgeçilirse boş taslaklar bir gün
   * sonra kendiliğinden temizleniyor.
   */
  useEffect(() => {
    if (id || f.id) return;
    let iptal = false;
    void (async () => {
      const { data, error } = await sb.rpc("admin_taslak_ac");
      if (iptal || error || !data) return;
      const yeni = (data as { id?: string }).id;
      if (yeni) {
        setF((p) => ({ ...p, id: yeni }));
        /* Yeni haber varsayılan olarak yayına gidiyor */
        setF((p) => ({ ...p, status: "published" }));
      }
    })();
    return () => { iptal = true; };
  }, [id, f.id, sb]);

  /* Sayfadan çıkarken uyar */
  useEffect(() => {
    if (!degisti) return;
    const uyar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, [degisti]);

  /** Adres kurallara uyuyor ve boşta mı — yazarken kontrol */
  async function slugKontrol() {
    if (!slugTaslak.trim() || slugTaslak === f.slug) { setSlugDurum(null); return; }
    const { data, error } = await sb.rpc("admin_slug_kontrol", {
      p_slug: slugTaslak.trim(),
      p_article_id: f.id || null,
    });
    if (error) { setSlugDurum({ uygun: false, sebep: error.message }); return; }
    setSlugDurum(data as { uygun: boolean; sebep?: string; onerilen?: string });
  }

  async function slugKaydet() {
    if (!f.id) return;
    setSlugKaydediyor(true);
    const { data, error } = await sb.rpc("admin_haber_slug_degistir", {
      p_id: f.id, p_slug: slugTaslak.trim(),
    });
    setSlugKaydediyor(false);
    if (error) { t.error(error.message); return; }
    const y = (data as { slug?: string } | null)?.slug ?? slugTaslak;
    setF((p) => ({ ...p, slug: y }));
    setSlugTaslak(y);
    setSlugDurum(null);
    t.success("Adres değiştirildi");
  }

  function guncelle(y: Partial<Form>) {
    setF((p) => ({ ...p, ...y }));
    setDegisti(true);
  }

  /* ── Medya yükleme ── */
  async function medyaYukle(dosya: File) {
    if (!f.id) {
      t.error("Önce haberi kaydet, sonra medya ekle");
      return;
    }
    setYukluyor(true);
    try {
      /*
       * ⚠ YOL SUNUCUDAN GELİYOR.
       * Medya, botun kullandığı düzenle aynı klasöre gidiyor:
       *   news/YYYY/AA/GG/{haber_id}/...
       * Haber silinince tüm medyası tek klasörde bulunup
       * temizlenebiliyor.
       */
      const { data: yol, error: yolErr } = await sb.rpc("admin_medya_yolu", {
        p_article_id: f.id, p_ad: dosya.name,
      });
      if (yolErr || !yol) throw new Error(yolErr?.message ?? "Yol alınamadı");

      const video = dosya.type.startsWith("video/");
      const { key } = await r2Yukle(dosya, "haber", String(yol));

      /*
       * ⚠ VİDEODA KAPAK KARESİ.
       * Video listede ve kartlarda görselsiz kalmasın diye ilk
       * kare çıkarılıp ayrıca yükleniyor. Tarayıcıda yapılıyor;
       * sunucuya video işleme yükü binmiyor.
       */
      let poster: string | null = null;
      let sure: number | null = null;
      if (video) {
        try {
          const kare = await videoKaresi(dosya);
          if (kare) {
            sure = kare.sure;
            const { data: pYol } = await sb.rpc("admin_medya_yolu", {
              p_article_id: f.id, p_ad: dosya.name.replace(/\.[^.]+$/, "") + "-kapak.jpg",
            });
            if (pYol) {
              const p = await r2Yukle(kare.dosya, "haber", String(pYol));
              poster = p.key;
            }
          }
        } catch {
          // Kapak çıkarılamadıysa video yine yükleniyor
        }
      }

      const { data: yeni, error } = await sb.rpc("admin_medya_ekle", {
        p: {
          article_id: f.id,
          type: video ? "video" : "image",
          storage_key: key,
          poster_key: poster,
          duration_sec: sure ? String(Math.round(sure)) : null,
          bytes: String(dosya.size),
        },
      });
      if (error) throw new Error(error.message);

      setMedya((p) => [...p, yeni as unknown as Medya]);
      t.success(video ? "Video eklendi" : "Görsel eklendi");
      await yukle();
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setYukluyor(false);
    }
  }

  async function medyaSil() {
    if (!silinecekMedya) return;
    const { error } = await sb.rpc("admin_medya_sil", { p_id: silinecekMedya.id });
    setSilinecekMedya(null);
    if (error) { t.error(error.message); return; }
    t.success("Medya silindi");
    await yukle();
  }

  /* ── Kaydet ── */
  async function kaydet() {
    if (!f.title.trim()) { t.error("Başlık zorunlu"); setSekme("icerik"); return; }
    setKaydediyor(true);

    const { data, error } = await sb.rpc("admin_haber_kaydet", {
      p: {
        ...(f.id ? { id: f.id } : {}),
        title: f.title,
        summary: f.summary || null,
        body: f.body,
        status: f.status,
        son_dakika: f.son_dakika,
        published_at: f.published_at ? new Date(f.published_at).toISOString() : null,
        category_id: f.category_id || null,
        city_id: f.city_id || null,
        source_id: f.source_id || null,
        author_id: f.author_id || null,
        byline: f.byline || null,
        tags: f.tags,
        cover_media_id: f.cover_media_id || null,
        medya: medya.map((m) => ({
          id: m.id, sort_order: m.sort_order,
          caption: m.caption, credit: m.credit,
        })),
        ceviriler: ceviriler.filter((c) => c.baslik.trim() || c.ozet.trim()),
        ai: {
          ozet: ai.ozet || null,
          instagram: ai.instagram || null,
          onem_puani: ai.onem_puani || null,
          onem_gerekce: ai.onem_gerekce || null,
          cocuk_guvenli: ai.cocuk_guvenli,
          guvenlik_sebepleri: ai.guvenlik_sebepleri,
        },
      },
    });
    setKaydediyor(false);
    if (error) { t.error(error.message); return; }

    setDegisti(false);
    t.success(f.id ? "Haber kaydedildi" : "Haber oluşturuldu");

    const yeni = (data as { haber?: { id?: string } } | null)?.haber?.id;
    if (!f.id && yeni) {
      window.location.href = `/haberler/${yeni}/duzenle`;
    }
  }

  if (yukleniyor) {
    return <div className="flex flex-col gap-4">
      <Skeleton className="h-14 w-full" /><Skeleton className="h-80 w-full" />
    </div>;
  }

  const govdeMetni = f.body
    .map((b) => b.text ?? "")
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="flex flex-col gap-4">
      {/* ── Üst çubuk ── */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-[16px] bg-bg/92 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap gap-1.5">
          {SEKMELER.map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => setSekme(s.k)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                sekme === s.k ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
              }`}
            >
              <Icon name={s.ikon as "news"} size={14} />
              {s.ad}
            </button>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-2">
          {degisti && (
            <span className="text-[12.5px] text-orange-ink">Kaydedilmedi</span>
          )}
          <Button variant="ghost" size="sm"
            onClick={() => { window.location.href = f.id ? `/haberler/${f.id}` : "/haberler"; }}>
            Vazgeç
          </Button>
          <Button size="sm" onClick={kaydet} loading={kaydediyor}>
            <Icon name="check" size={15} /> Kaydet
          </Button>
        </div>
      </div>

      {/* ══ İÇERİK ══ */}
      {sekme === "icerik" && (
        <Card className="flex flex-col gap-5 p-5">
          {/*
            ⚠ DURUM SEÇİMİ YALNIZCA DÜZENLEMEDE.
            Yeni haberde gereksiz: panelden haber ekleyen zaten
            yetkili ve yayımlamak istiyor. Doğrudan yayına
            giriyor; sonradan düzenlerken durum değiştirilebiliyor.
          */}
          {f.id && (
          <div>
            <div className="kb-eyebrow mb-2.5">Durum</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DURUMLAR.map((d) => {
                const secili = f.status === d.v;
                return (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => guncelle({ status: d.v })}
                    className={`flex flex-col items-center gap-1.5 rounded-[14px] border-2 px-3 py-3.5 transition-colors ${
                      secili ? "border-transparent text-white" : "border-line2 hover:border-line"
                    }`}
                    style={secili ? { background: d.renk } : undefined}
                  >
                    <Icon name={d.ikon as "check"} size={18} />
                    <span className="text-[12.5px] font-semibold">{d.ad}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Künye, kategori, şehir — üstte, yan yana ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Künye" hint="kaynak ya da yazarımız">
              <KunyeSec
                kaynakId={f.source_id}
                yazarId={f.author_id}
                cdn={cdn}
                onSec={(v) => guncelle({ source_id: v.source_id, author_id: v.author_id })}
              />
            </Field>
            <Field label="Kategori">
              <KategoriSec deger={f.category_id}
                onSec={(id) => guncelle({ category_id: id })} />
            </Field>
            <Field label="Şehir" hint="isteğe bağlı">
              <SehirSec deger={f.city_id}
                onSec={(id) => guncelle({ city_id: id })} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Yayın tarihi" hint="boşsa yayına alınca şimdi">
              <Input type="datetime-local" value={f.published_at}
                onChange={(e) => guncelle({ published_at: e.target.value })} />
            </Field>

            {/* Son dakika — kutu, tıkla aç/kapa */}
            <div>
              <div className="kb-eyebrow mb-2.5">Öne çıkarma</div>
              <button
                type="button"
                onClick={() => guncelle({ son_dakika: !f.son_dakika })}
                aria-pressed={f.son_dakika}
                className={`flex w-full items-center justify-center gap-2 rounded-[14px] border-2 px-4 py-3 transition-colors ${
                  f.son_dakika
                    ? "border-transparent bg-danger text-white"
                    : "border-line2 hover:border-line"
                }`}
              >
                <Icon name={f.son_dakika ? "check" : "clock"} size={16} />
                <span className="text-[13.5px] font-bold">Son dakika</span>
              </button>
            </div>
          </div>

          {/* ── Çocuk güvenliği: üç kart ── */}
          <div>
            <div className="kb-eyebrow mb-2.5">Çocuk güvenliği</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {COCUK.map((c) => {
                const secili = ai.cocuk_guvenli === c.v;
                return (
                  <button
                    key={String(c.v)}
                    type="button"
                    onClick={() => { setAi({ ...ai, cocuk_guvenli: c.v }); setDegisti(true); }}
                    className={`flex flex-col gap-1 rounded-[14px] border-2 px-3.5 py-3 text-start transition-colors ${
                      secili ? "border-transparent text-white" : "border-line2 hover:border-line"
                    }`}
                    style={secili ? { background: c.renk } : undefined}
                  >
                    <span className="text-[13px] font-bold">{c.ad}</span>
                    <span className={`text-[11.5px] leading-snug ${secili ? "opacity-85" : "text-muted2"}`}>
                      {c.aciklama}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Divider />

          <Field label="Başlık" hint={`${f.title.length}/300`}>
            <Input value={f.title} maxLength={300}
              onChange={(e) => guncelle({ title: e.target.value })}
              placeholder="Haber başlığı" />
          </Field>

          <Field label="Özet" hint="listelerde ve paylaşımda görünür">
            <Textarea value={f.summary} className="min-h-[80px]" maxLength={500}
              onChange={(e) => guncelle({ summary: e.target.value })}
              placeholder="Kısa özet…" />
          </Field>

          <Field
            label="Haber metni"
            hint="Boş satır bırakarak paragraf ayır"
          >
            <Textarea
              value={govdeMetni}
              className="min-h-[340px] leading-relaxed"
              onChange={(e) => {
                /*
                 * Düz metin ↔ blok dönüşümü.
                 * Zengin editör yerine düz metin: haber metni
                 * biçimlendirme istemiyor ve düz metin her
                 * cihazda sorunsuz çalışıyor. Boş satır
                 * paragrafı ayırıyor.
                 */
                const bloklar: Blok[] = e.target.value
                  .split(/\n{2,}/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => ({ type: "paragraph", text: s }));
                guncelle({ body: bloklar });
              }}
              placeholder="Haber metnini buraya yaz…"
            />
          </Field>

          <div className="kb-num text-[12px] text-muted2">
            {f.body.length} paragraf · {govdeMetni.length.toLocaleString("tr-TR")} karakter
            · ~{Math.max(1, Math.round(govdeMetni.split(/\s+/).length / 200))} dk okuma
          </div>

          {/*
            ⚠ ADRES DEĞİŞTİRİLEBİLİR AMA KONTROLLÜ.
            Yayımlanmış bir haberin adresi değişince eski
            bağlantılar kırılıyor; bu yüzden ayrı bir işlem
            ve kaydetmeden önce kontrol ediliyor.
          */}
          {f.id && (
            <div>
              <div className="kb-eyebrow mb-2">Adres</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="kb-num text-[12.5px] text-muted2">/haber/</span>
                <input
                  value={slugTaslak}
                  onChange={(e) => { setSlugTaslak(e.target.value); setSlugDurum(null); }}
                  onBlur={() => void slugKontrol()}
                  placeholder="haber-adresi"
                  className="min-w-[180px] flex-1 rounded-[12px] border border-line2 bg-surface px-3 py-2 font-mono text-[13px] outline-none focus:border-line"
                />
                {slugTaslak !== f.slug && (
                  <Button size="sm" variant="ghost" loading={slugKaydediyor}
                    onClick={slugKaydet}>
                    Adresi değiştir
                  </Button>
                )}
              </div>
              {slugDurum && (
                <p className={`mt-1.5 text-[12px] ${
                  slugDurum.uygun ? "text-green" : "text-danger"
                }`}>
                  {slugDurum.uygun ? "Bu adres kullanılabilir" : slugDurum.sebep}
                  {slugDurum.onerilen && (
                    <button type="button"
                      onClick={() => { setSlugTaslak(slugDurum.onerilen!); setSlugDurum(null); }}
                      className="ms-2 underline">
                      {slugDurum.onerilen} kullan
                    </button>
                  )}
                </p>
              )}
            </div>
          )}

          <Divider />
          <div>
            <div className="kb-eyebrow mb-2">Etiketler</div>

            {/*
              Etiketler kutunun İÇİNDE duruyor.
              Ayrı bir liste hâlinde altta dururken kullanıcı
              eklediğini görmüyordu.
            */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-line2 bg-surface p-2">
              {f.tags.map((e) => (
                <span key={e}
                  className="flex items-center gap-1.5 rounded-full bg-chip px-2.5 py-1 text-[12.5px] font-medium">
                  {e}
                  <button type="button"
                    aria-label={`${e} etiketini kaldır`}
                    onClick={() => guncelle({ tags: f.tags.filter((x) => x !== e) })}
                    className="text-muted2 hover:text-danger">
                    <Icon name="close" size={11} />
                  </button>
                </span>
              ))}

              <input
                value={etiketGirdi}
                onChange={(e) => setEtiketGirdi(e.target.value)}
                onKeyDown={(e) => {
                  /*
                   * Enter VE virgül ekliyor — ikisi de doğal.
                   * Boş kutuda geri tuşu son etiketi siliyor:
                   * yazarken fareye uzanmak gerekmiyor.
                   */
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const y = etiketGirdi.trim().toLocaleLowerCase("tr").replace(/,$/, "");
                    if (!y || f.tags.includes(y)) { setEtiketGirdi(""); return; }
                    guncelle({ tags: [...f.tags, y] });
                    setEtiketGirdi("");
                    return;
                  }
                  if (e.key === "Backspace" && !etiketGirdi && f.tags.length > 0) {
                    guncelle({ tags: f.tags.slice(0, -1) });
                  }
                }}
                onBlur={() => {
                  /* Odaktan çıkarken yazılmış etiketi kaybetme */
                  const y = etiketGirdi.trim().toLocaleLowerCase("tr");
                  if (y && !f.tags.includes(y)) guncelle({ tags: [...f.tags, y] });
                  setEtiketGirdi("");
                }}
                placeholder={f.tags.length === 0 ? "deprem, afet, yardım…" : "ekle…"}
                className="min-w-[120px] flex-1 bg-transparent px-1.5 py-1 text-[13.5px] outline-none"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-muted2">
              Enter ya da virgülle ekle · silmek için ×
            </p>
          </div>


        </Card>
      )}

      {/* ══ MEDYA ══ */}
      {sekme === "medya" && (
        <Card className="flex flex-col gap-4 p-5">
          {!f.id ? (
            /* Taslak açılana kadar kısa bir an — yükleniyor göster */
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <label className="w-fit cursor-pointer">
                <span className="kb-lift inline-flex items-center gap-2 rounded-full bg-solid px-4 py-2.5 text-[13.5px] font-semibold text-on-solid">
                  <Icon name={yukluyor ? "loading" : "plus"} size={16} />
                  {yukluyor ? "Yükleniyor…" : "Medya ekle"}
                </span>
                <input type="file" accept="image/*,video/*" multiple className="hidden"
                  disabled={yukluyor}
                  onChange={(e) => {
                    const dosyalar = Array.from(e.target.files ?? []);
                    void (async () => {
                      for (const d of dosyalar) await medyaYukle(d);
                    })();
                    e.target.value = "";
                  }} />
              </label>

              {medya.length === 0 ? (
                <EmptyState title="Medya yok" />
              ) : (
                /*
                  Izgara: mobilde 2, masaüstünde 3 sütun.
                  Açıklama görselin ALTINDA — üstüne bindirilince
                  görseli kapatıyordu.
                */
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {medya.map((m, idx) => (
                    <div key={m.id} className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setGaleri(idx)}
                        className={`relative block w-full overflow-hidden rounded-[14px] border-2 transition-colors ${
                          f.cover_media_id === m.id ? "border-solid" : "border-transparent"
                        }`}
                        style={{ aspectRatio: "4 / 3", background: "var(--chip)" }}
                      >
                        {medyaOnizleme(m, cdn) ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={medyaOnizleme(m, cdn) ?? ""} alt=""
                            loading="lazy"
                            className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted2">
                            <Icon name="media" size={20} />
                          </span>
                        )}

                        {m.type === "video" && (
                          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10.5px] font-semibold text-white">
                            <Icon name="play" size={10} />
                            {m.duration_sec ? `${Math.round(m.duration_sec)} sn` : "Video"}
                          </span>
                        )}
                        {/*
                          ⚠ KAPAK SEÇİMİ YILDIZLA.
                          Altta "Kapak yap" düğmesi vardı; her kart
                          iki satır yer kaplıyordu. Yıldız görselin
                          içinde — kapak olanın yıldızı dolu.
                        */}
                        {m.type === "image" && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={f.cover_media_id === m.id ? "Kapak" : "Kapak yap"}
                            title={f.cover_media_id === m.id ? "Kapak" : "Kapak yap"}
                            onClick={(e) => {
                              e.stopPropagation();
                              guncelle({ cover_media_id: m.id });
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.stopPropagation();
                              guncelle({ cover_media_id: m.id });
                            }}
                            className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                              f.cover_media_id === m.id
                                ? "bg-solid text-on-solid"
                                : "bg-black/45 text-white hover:bg-black/65"
                            }`}
                          >
                            <Icon name="star" size={15}
                              dolu={f.cover_media_id === m.id} />
                          </span>
                        )}
                      </button>

                      <Input value={m.caption ?? ""} className="text-[12.5px]"
                        placeholder="Açıklama"
                        onChange={(e) => {
                          setMedya((p) => p.map((x) =>
                            x.id === m.id ? { ...x, caption: e.target.value } : x));
                          setDegisti(true);
                        }} />

                      <div className="flex items-center">
                        <Button variant="ghost" size="sm" className="ms-auto"
                          onClick={() => setSilinecekMedya(m)}>
                          <Icon name="trash" size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ══ DİLLER ══ */}
      {sekme === "dil" && (
        <Card className="flex flex-col gap-4 p-5">
          {/*
            ⚠ TEK DİL GÖSTERİLİYOR.
            Üç dilin alanları alt alta dururken sayfa çok uzuyor
            ve hangi dilde çalışıldığı kayboluyordu. Üstteki
            seçiciyle dil değişiyor, yalnızca o dilin alanları
            görünüyor. Yazılanlar korunuyor — kayıt tek seferde.
          */}
          <div className="flex flex-wrap gap-1.5">
            {DILLER.map((d) => {
              const dolu = ceviriler.some(
                (c) => c.locale === d.k && (c.baslik.trim() || c.ozet.trim()));
              return (
                <button
                  key={d.k}
                  type="button"
                  onClick={() => setAktifDil(d.k)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
                    aktifDil === d.k ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
                  }`}
                >
                  <span aria-hidden style={{ fontSize: 15 }}>{d.bayrak}</span>
                  {d.ad}
                  {dolu && (
                    <span
                      aria-label="dolu"
                      className={`h-1.5 w-1.5 rounded-full ${
                        aktifDil === d.k ? "bg-on-solid/70" : "bg-green"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {(() => {
            const c = ceviriler.find((x) => x.locale === aktifDil)
              ?? { locale: aktifDil, baslik: "", ozet: "", icerik: "", status: "" };
            const guncelleCeviri = (y: Partial<Ceviri>) => {
              setCeviriler((p) => {
                const v = p.find((x) => x.locale === aktifDil);
                if (!v) return [...p, { ...c, ...y }];
                return p.map((x) => (x.locale === aktifDil ? { ...x, ...y } : x));
              });
              setDegisti(true);
            };

            return (
              <div className="flex flex-col gap-4">
                {c.status && c.status !== "ready" && (
                  <Badge tone="accent">{c.status}</Badge>
                )}
                <Field label="Başlık">
                  <Input value={c.baslik}
                    onChange={(e) => guncelleCeviri({ baslik: e.target.value })} />
                </Field>
                <Field label="Özet">
                  <Textarea value={c.ozet} className="min-h-[80px]"
                    onChange={(e) => guncelleCeviri({ ozet: e.target.value })} />
                </Field>
                <Field label="Metin" hint="boşsa AI üretir">
                  <Textarea value={c.icerik} className="min-h-[220px] leading-relaxed"
                    onChange={(e) => guncelleCeviri({ icerik: e.target.value })} />
                </Field>
              </div>
            );
          })()}
        </Card>
      )}

      {/* ══ AI ══ */}
      {sekme === "ai" && (
        <Card className="flex flex-col gap-4 p-5">
          <p className="text-[13px] leading-relaxed text-muted">
            AI servisinin ürettiği alanlar. Düzeltirsen elle yapılmış sayılır
            ve AI bir daha üstüne yazmaz.
          </p>

          <Field label="AI özeti">
            <Textarea value={ai.ozet} className="min-h-[80px]"
              onChange={(e) => { setAi({ ...ai, ozet: e.target.value }); setDegisti(true); }} />
          </Field>

          <Field label="Instagram metni" hint="paylaşım için hazır metin">
            <Textarea value={ai.instagram} className="min-h-[110px]"
              onChange={(e) => { setAi({ ...ai, instagram: e.target.value }); setDegisti(true); }} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Önem puanı" hint="0–10">
              <Input type="number" min={0} max={10} value={ai.onem_puani}
                onChange={(e) => { setAi({ ...ai, onem_puani: e.target.value }); setDegisti(true); }} />
            </Field>
            <Field label="Önem gerekçesi">
              <Input value={ai.onem_gerekce}
                onChange={(e) => { setAi({ ...ai, onem_gerekce: e.target.value }); setDegisti(true); }} />
            </Field>
          </div>

        </Card>
      )}

      <MedyaGaleri
        medya={medya}
        acikIndex={galeri}
        onKapat={() => setGaleri(null)}
        cdn={cdn}
      />

      <ConfirmDialog
        open={Boolean(silinecekMedya)}
        onClose={() => setSilinecekMedya(null)}
        title="Medya silinsin mi?"
        description="Dosya depodan da kaldırılır. Geri alınamaz."
        confirmLabel="Sil"
        onConfirm={medyaSil}
      />
    </div>
  );
}

/**
 * Videonun ilk karesini görsele çevirir.
 *
 * ⚠ TARAYICIDA YAPILIYOR. Sunucuda `ffmpeg` çalıştırmak
 * gerekirdi; bu yol hem hızlı hem sunucuya yük bindirmiyor.
 * Başarısız olursa video yine yükleniyor, sadece kapağı olmuyor.
 */
async function videoKaresi(
  dosya: File,
): Promise<{ dosya: File; sure: number } | null> {
  return new Promise((coz) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const temizle = () => { URL.revokeObjectURL(video.src); };

    video.onloadedmetadata = () => {
      // Baştan 0.1 sn: ilk kare bazen siyah oluyor
      video.currentTime = Math.min(0.1, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
        c.toBlob((b) => {
          temizle();
          if (!b) { coz(null); return; }
          coz({
            dosya: new File([b], "kapak.jpg", { type: "image/jpeg" }),
            sure: video.duration,
          });
        }, "image/jpeg", 0.85);
      } catch {
        temizle();
        coz(null);
      }
    };

    video.onerror = () => { temizle(); coz(null); };
    video.src = URL.createObjectURL(dosya);
  });
}
