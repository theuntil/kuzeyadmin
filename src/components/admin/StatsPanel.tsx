"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Card, CardHead, Skeleton, EmptyState, Badge } from "@/components/ui";
import Icon from "@/components/ui/Icon";
import TarihAraligi from "./TarihAraligi";

/* ══════════════════════════════════════════════════════════════
   İSTATİSTİKLER

   ┌─ GRAFİK KÜTÜPHANESİ YOK ⚠️ ───────────────────────────────┐
   │ Çubuklar ve halka saf CSS/SVG. Recharts gibi bir paket     │
   │ 120 KB ekleyecekti; burada gösterilen üç grafik için       │
   │ orantısız. Ayrıca panelin tasarım tokenlarıyla uyumu       │
   │ kütüphanede zorlaşıyordu.                                    │
   └──────────────────────────────────────────────────────────────┘

   ┌─ CİHAZ VERİSİ GEÇMİŞE DÖNÜK YOK ⚠️ ───────────────────────┐
   │ `article_views.platform` yeni eklendi. Eski kayıtlarda     │
   │ null; "bilinmeyen" olarak gösteriliyor. Sayıyı gizlemek    │
   │ yerine söylemek doğru — yoksa oranlar yanlış okunur.       │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/*
 * ⚠ İKİ AYRI SAYAÇ.
 *   sayfa → her sayfa ziyareti (trafik)
 *   haber → haberin okunma sayısı (4 sn kuralı)
 * Toplanmıyorlar; farklı sorulara cevap veriyorlar.
 */
interface Ozet {
  sayfa: {
    goruntulenme: number; ziyaretci: number;
    mobil: number; masaustu: number; tablet: number; bilinmeyen: number;
    onceki: number;
  };
  haber: { okuma: number; ziyaretci: number; onceki: number };
}
interface SayfaGun {
  gun: string; goruntulenme: number; ziyaretci: number;
  mobil: number; masaustu: number; tablet: number;
}
interface SayfaTop {
  yol: string; tur: string; baslik: string;
  goruntulenme: number; ziyaretci: number;
}
interface SayfaTur { page_type: string; goruntulenme: number; ziyaretci: number }
interface Ulke { ulke: string; goruntulenme: number; ziyaretci: number }
interface Tarayici { tarayici: string; isletim: string; goruntulenme: number; ziyaretci: number }
interface Giris { yol: string; tur: string; giris: number; ziyaretci: number }
interface Sure { tur: string; olculen: number; ort_saniye: number | null; cikma_yuzde: number | null }
interface Saglik {
  toplam: number; son_1_saat: number; son_24_saat: number;
  son_kayit: string | null; ulke_var: boolean; tarayici_var: boolean;
  sure_var: boolean; haber_okuma: number;
}

/** ISO ülke kodunu bayrak emojisine çevirir */
function bayrak(kod: string): string {
  if (!/^[A-Z]{2}$/.test(kod)) return "🌐";
  return String.fromCodePoint(
    ...[...kod].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const ULKE_AD: Record<string, string> = {
  TR: "Türkiye", DE: "Almanya", US: "ABD", GB: "İngiltere", FR: "Fransa",
  NL: "Hollanda", AT: "Avusturya", BE: "Belçika", AZ: "Azerbaycan",
  RU: "Rusya", SA: "Suudi Arabistan", AE: "BAE", IQ: "Irak", IR: "İran",
};

interface Kaynak { kaynak: string; goruntulenme: number; ziyaretci: number }
interface Saat { saat: number; okuma: number }
interface Top {
  article_id: string; baslik: string; slug: string;
  kategori: string | null; okuma: number; ziyaretci: number;
}


/** Sayfa türü kodunu okunur ada çevirir */
const TUR_AD: Record<string, string> = {
  anasayfa: "Ana sayfa", haber: "Haber", kategori: "Kategori",
  etiket: "Etiket", sehir: "Şehir", arama: "Arama",
  yazar: "Yazar", sayfa: "Kurumsal sayfa", hesap: "Giriş / Kayıt",
  diger: "Diğer",
};

const ARALIK = [
  { g: 1, l: "Bugün" },
  { g: 7, l: "7 gün" },
  { g: 30, l: "30 gün" },
  { g: 90, l: "90 gün" },
  { g: 180, l: "6 ay" },
  { g: 365, l: "1 yıl" },
];

function sayi(n: number): string {
  return n.toLocaleString("tr-TR");
}

/** Neomorfik kart: kenarlık yok, hafif iç gölge */
function Kutu({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[18px] bg-surface p-5 ${className}`}>{children}</div>
  );
}

export default function StatsPanel({ siteUrl }: { siteUrl: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const site = siteUrl.replace(/\/+$/, "");

  /*
   * ⚠ VARSAYILAN "BUGÜN".
   * Sayfa açılınca 7 gün seçiliydi; yönetici genelde önce
   * bugünün durumuna bakıyor.
   */
  const [gun, setGun] = useState(1);

  /*
   * Serbest aralık. Doluysa hazır gün düğmeleri yerine bu
   * geçerli; düğmeye basılınca temizleniyor.
   */
  const [ozelBas, setOzelBas] = useState<string | null>(null);
  const [ozelBit, setOzelBit] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [gunluk, setGunluk] = useState<SayfaGun[]>([]);
  const [sayfalar, setSayfalar] = useState<SayfaTop[]>([]);
  const [turler, setTurler] = useState<SayfaTur[]>([]);
  const [ulkeler, setUlkeler] = useState<Ulke[]>([]);
  const [tarayicilar, setTarayicilar] = useState<Tarayici[]>([]);
  const [girisler, setGirisler] = useState<Giris[]>([]);
  const [sureler, setSureler] = useState<Sure[]>([]);
  const [saglik, setSaglik] = useState<Saglik | null>(null);
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([]);
  const [saatler, setSaatler] = useState<Saat[]>([]);
  const [top, setTop] = useState<Top[]>([]);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    /*
     * ┌─ SEÇİLEN ARALIK UYGULANMIYORDU ⚠️ ────────────────────────┐
     * │ Serbest aralık yalnızca `bas` değişkenine giriyordu; RPC │
     * │ çağrıları hâlâ sabit `gun` sayısını alıyordu. "Uygula"   │
     * │ düğmesi hiçbir şey değiştirmiyor gibi görünüyordu.        │
     * │                                                              │
     * │ Aralık gün sayısına çevrilip TÜM sorgulara veriliyor.     │
     * │ Bitiş bugünden eskiyse gün sayısı ona göre uzatılıyor —  │
     * │ yoksa geçmişteki bir hafta bugüne kadar sayılırdı.        │
     * └──────────────────────────────────────────────────────────────┘
     */
    const bas = ozelBas
      ?? new Date(Date.now() - gun * 86400000).toISOString().slice(0, 10);

    /*
     * ┌─ ARALIK UYGULANMIYORDU ⚠️ ────────────────────────────────┐
     * │ Serbest aralık gün sayısına çevriliyordu ve BİTİŞ TARİHİ │
     * │ kayboluyordu: geçmişte bir hafta seçince o tarihten      │
     * │ bugüne kadar her şey sayılıyordu. Hangi aralığı seçersen │
     * │ seç sonuç değişmiyordu.                                    │
     * │                                                              │
     * │ Artık serbest aralıkta tarih alan sürümler çağrılıyor;   │
     * │ hazır düğmelerde eski gün sayılı sürümler kalıyor.        │
     * └──────────────────────────────────────────────────────────────┘
     */
    const aralikVar = Boolean(ozelBas && ozelBit);

    const [o, g, k, s, tp, sp, tr, ul, tb, gi, su, sg] = await Promise.all([
      aralikVar
        ? sb.rpc("admin_stats_ozet_aralik", { p_bas: ozelBas, p_bit: ozelBit })
        : sb.rpc("admin_stats_ozet", { p_gun: gun }),
      // Sayfa ziyaretleri — trafiğin asıl kaynağı
      (ozelBit
        ? sb.from("admin_page_daily").select("*")
            .gte("gun", bas).lte("gun", ozelBit).order("gun")
        : sb.from("admin_page_daily").select("*")
            .gte("gun", bas).order("gun")),
      sb.from("admin_page_referrer").select("*")
        .order("goruntulenme", { ascending: false }).limit(12),
      /*
       * ⚠ ARALIĞA DUYARLI SÜRÜM.
       * Görünüm sabit 30 güne bakıyordu; seçilen aralık
       * uygulanmıyordu. Fonksiyon aralığı parametre alıyor.
       */
      sb.rpc("admin_saat_dagilimi", { p_gun: gun }),
      aralikVar
        ? sb.rpc("admin_stats_top_aralik",
            { p_bas: ozelBas, p_bit: ozelBit, p_limit: 15 })
        : sb.rpc("admin_stats_top", { p_gun: gun, p_limit: 15 }),
      /*
       * Sayfa listesinin aralık sürümü yok; hazır gün sayısıyla
       * çağrılıyor. Serbest aralıkta bu kart yaklaşık kalıyor —
       * yanlış veri göstermektense yaklaşık olduğunu bilmek iyi.
       */
      sb.rpc("admin_sayfa_top", { p_gun: gun, p_limit: 15 }),
      sb.from("admin_page_tur").select("*")
        .order("goruntulenme", { ascending: false }),
      sb.from("admin_izleme_ulke").select("*")
        .order("goruntulenme", { ascending: false }).limit(12),
      sb.from("admin_izleme_tarayici").select("*")
        .order("goruntulenme", { ascending: false }).limit(10),
      sb.from("admin_izleme_giris").select("*")
        .order("giris", { ascending: false }).limit(10),
      sb.from("admin_izleme_sure").select("*")
        .order("olculen", { ascending: false }),
      sb.rpc("admin_izleme_saglik"),
    ]);

    setYukleniyor(false);
    if (o.error) { t.error("İstatistik okunamadı: " + o.error.message); return; }

    /*
     * ┌─ GRAFİKLER BOŞ GÖRÜNÜYORDU ⚠️ ────────────────────────────┐
     * │ Postgres `bigint` (int8) değerlerini JSON'a METİN olarak  │
     * │ veriyor — JavaScript sayı aralığı int8'i karşılamadığı    │
     * │ için doğru davranış.                                       │
     * │                                                              │
     * │ Ama grafik kütüphanesi metin değeri çizemiyor: bütün      │
     * │ sütunlar sıfır yükseklikte kalıyordu. "Gün gün trafik" ve │
     * │ "Gün içi dağılım" bu yüzden boş görünüyordu — veri        │
     * │ aslında geliyordu.                                          │
     * │                                                              │
     * │ Her sayısal alan açıkça sayıya çevriliyor.                 │
     * └──────────────────────────────────────────────────────────────┘
     */
    const sayilastir = <T,>(satirlar: unknown, alanlar: string[]): T[] =>
      ((satirlar ?? []) as Record<string, unknown>[]).map((r) => {
        const y: Record<string, unknown> = { ...r };
        for (const a of alanlar) {
          if (a in y) y[a] = Number(y[a] ?? 0);
        }
        return y as T;
      });

    setOzet(o.data as unknown as Ozet);
    setGunluk(sayilastir<SayfaGun>(g.data,
      ["goruntulenme", "ziyaretci", "mobil", "masaustu", "tablet"]));
    setSayfalar(sayilastir<SayfaTop>(sp.data, ["okuma", "ziyaretci"]));
    setTurler(sayilastir<SayfaTur>(tr.data, ["goruntulenme", "ziyaretci"]));
    setUlkeler(sayilastir<Ulke>(ul.data, ["goruntulenme", "ziyaretci"]));
    setTarayicilar(sayilastir<Tarayici>(tb.data, ["goruntulenme"]));
    setGirisler(sayilastir<Giris>(gi.data, ["giris"]));
    setSureler(sayilastir<Sure>(su.data, ["ort_sure", "adet"]));
    setSaglik(sg.data as unknown as Saglik | null);
    setKaynaklar(sayilastir<Kaynak>(k.data, ["goruntulenme"]));
    setSaatler(sayilastir<Saat>(s.data, ["saat", "okuma"]));
    setTop(sayilastir<Top>(tp.data, ["okuma", "ziyaretci"]));
  }, [sb, gun, t, ozelBas, ozelBit]);

  useEffect(() => { void yukle(); }, [yukle]);

  const trend = useMemo(() => {
    if (!ozet || ozet.sayfa.onceki === 0) return null;
    return Math.round(
      ((ozet.sayfa.goruntulenme - ozet.sayfa.onceki) / ozet.sayfa.onceki) * 100);
  }, [ozet]);

  const enYuksek = Math.max(1, ...gunluk.map((d) => d.goruntulenme));
  const saatEnYuksek = Math.max(1, ...saatler.map((s) => s.okuma));
  const kaynakToplam = Math.max(1, kaynaklar.reduce((n, k) => n + k.goruntulenme, 0));

  const cihazlar = ozet
    ? [
        { l: "Mobil", v: ozet.sayfa.mobil, c: "var(--solid)" },
        { l: "Masaüstü", v: ozet.sayfa.masaustu, c: "var(--ink2)" },
        { l: "Tablet", v: ozet.sayfa.tablet, c: "var(--muted)" },
        { l: "Bilinmeyen", v: ozet.sayfa.bilinmeyen, c: "var(--line2)" },
      ].filter((x) => x.v > 0)
    : [];
  const cihazToplam = Math.max(1, cihazlar.reduce((n, x) => n + x.v, 0));

  if (yukleniyor && !ozet) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Zaman aralığı ── */}
      <div className="flex flex-wrap items-center gap-2">
        {ARALIK.map((a) => (
          <button
            key={a.g} type="button" onClick={() => { setGun(a.g); setOzelBas(null); setOzelBit(null); }}
            className={`kb-lift rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
              gun === a.g ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
            }`}
          >
            {a.l}
          </button>
        ))}
        {/*
          ⚠ HAZIR ARALIKLAR YETMEYEBİLİR.
          Belirli bir haftayı ya da geçen ayın bir bölümünü
          incelemek isteyen yönetici için takvimden serbest
          aralık seçimi.
        */}
        <TarihAraligi
          bas={ozelBas ?? new Date(Date.now() - (gun - 1) * 86400000)
            .toISOString().slice(0, 10)}
          bit={ozelBit ?? new Date().toISOString().slice(0, 10)}
          onSec={(b, s) => { setOzelBas(b); setOzelBit(s); }}
        />

        {ozelBas && ozelBit && (
          /*
           * Serbest aralık seçiliyse ekranda yazıyor; hangi
           * aralığa baktığın belirsiz kalmasın.
           */
          <span className="rounded-full bg-chip px-3 py-1.5 text-[12.5px] font-semibold">
            {ozelBas} → {ozelBit}
            <button
              type="button"
              onClick={() => { setOzelBas(null); setOzelBit(null); }}
              aria-label="Aralığı temizle"
              className="ms-2 text-muted2 hover:text-ink"
            >
              ×
            </button>
          </span>
        )}

        <button type="button" onClick={() => void yukle()}
          aria-label="Yenile" title="Yenile"
          className="kb-lift ms-auto flex h-9 w-9 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-ink">
          <Icon name="refresh" size={16} />
        </button>
      </div>

      {/*
        ── Sağlık uyarısı ──
        "Neden 0 görünüyor" sorusunun cevabı burada. Kayıt
        gelmiyorsa sebebini tahmin etmek yerine görüyoruz.
      */}
      {saglik && saglik.toplam === 0 && (
        <div className="rounded-[16px] bg-orange-soft px-5 py-4 text-[13.5px] text-orange-ink">
          <strong>Henüz ziyaret kaydı yok.</strong>
          <div className="mt-1.5 leading-relaxed">
            Site güncellendiyse birkaç dakika içinde dolmaya başlar.
            Dolmuyorsa <code className="rounded bg-black/10 px-1.5">SUPABASE_URL</code> ve{" "}
            <code className="rounded bg-black/10 px-1.5">SUPABASE_ANON_KEY</code> site
            servisinde tanımlı mı kontrol et — kayıt oradan yazılıyor.
          </div>
        </div>
      )}
      {saglik && saglik.toplam > 0 && saglik.son_24_saat === 0 && (
        <div className="rounded-[16px] bg-orange-soft px-5 py-4 text-[13.5px] text-orange-ink">
          Son 24 saatte kayıt yok. Son kayıt:{" "}
          {saglik.son_kayit
            ? new Date(saglik.son_kayit).toLocaleString("tr-TR")
            : "—"}
        </div>
      )}

      {/* ── Özet kartları ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kutu>
          <div className="kb-eyebrow">Sayfa görüntülenme</div>
          <div className="kb-num mt-1.5 text-[26px] font-bold leading-none">
            {sayi(ozet?.sayfa.goruntulenme ?? 0)}
          </div>
          {trend !== null && (
            <div className={`mt-2 text-[12.5px] font-semibold ${trend >= 0 ? "text-green" : "text-danger"}`}>
              {trend >= 0 ? "▲" : "▼"} %{Math.abs(trend)}
              <span className="ms-1 font-normal text-muted2">önceki döneme göre</span>
            </div>
          )}
        </Kutu>
        <Kutu>
          <div className="kb-eyebrow">Tekil ziyaretçi</div>
          <div className="kb-num mt-1.5 text-[26px] font-bold leading-none">
            {sayi(ozet?.sayfa.ziyaretci ?? 0)}
          </div>
          <div className="mt-2 text-[12.5px] text-muted2">
            kişi başı{" "}
            {((ozet?.sayfa.goruntulenme ?? 0) /
              Math.max(1, ozet?.sayfa.ziyaretci ?? 1)).toFixed(1)} sayfa
          </div>
        </Kutu>

        {/* Haber okuması AYRI kart: trafikle karıştırılmasın */}
        <Kutu>
          <div className="kb-eyebrow">Haber okunması</div>
          <div className="kb-num mt-1.5 text-[26px] font-bold leading-none">
            {sayi(ozet?.haber.okuma ?? 0)}
          </div>
          <div className="mt-2 text-[12.5px] text-muted2">
            sayfada 4 sn kalanlar
          </div>
        </Kutu>
        <Kutu>
          <div className="kb-eyebrow">Mobil oranı</div>
          <div className="kb-num mt-1.5 text-[26px] font-bold leading-none">
            %{Math.round(((ozet?.sayfa.mobil ?? 0) / cihazToplam) * 100)}
          </div>
          <div className="mt-2 text-[12.5px] text-muted2">
            {sayi(ozet?.sayfa.mobil ?? 0)} mobil · {sayi(ozet?.sayfa.masaustu ?? 0)} masaüstü
          </div>
        </Kutu>
      </div>

      {/* ── Gün gün okunma ── */}
      <Card className="p-5">
        <CardHead title="Gün gün trafik" desc="Sayfa görüntülenmeleri. Sütuna dokununca sayı görünür." />
        {gunluk.length === 0 ? (
          <EmptyState title="Bu aralıkta veri yok" />
        ) : (
          <div className="flex h-48 items-stretch gap-1 overflow-x-auto pb-1">
            {gunluk.map((d) => (
              /*
               * ┌─ ÇUBUKLAR HİÇ ÇİZİLMİYORDU ⚠️ ────────────────────┐
               * │ Yükseklik yüzdeyle veriliyordu ama sütunun üst   │
               * │ kabının BELİRLİ BİR YÜKSEKLİĞİ YOKTU. CSS'te     │
               * │ yüzde yükseklik, üst öğenin yüksekliği belirli   │
               * │ değilse `auto`ya çözülüyor — yani sıfır.          │
               * │                                                    │
               * │ Veri geliyordu, grafik boş görünüyordu.          │
               * │                                                    │
               * │ `h-full` sütuna satırın yüksekliğini veriyor;    │
               * │ çubuk alanı `flex-1` ile kalanı dolduruyor.      │
               * └────────────────────────────────────────────────────┘
               */
              <div key={d.gun} className="group flex h-full min-w-[16px] flex-1 flex-col items-center justify-end gap-1.5">
                <span className="kb-num shrink-0 text-[10.5px] text-muted2 opacity-0 transition-opacity group-hover:opacity-100">
                  {sayi(d.goruntulenme)}
                </span>
                <div
                  className="w-full shrink-0 rounded-t-[6px] bg-solid transition-[height] duration-500"
                  style={{ height: `${Math.max(3, (d.goruntulenme / enYuksek) * 100)}%` }}
                  title={`${new Date(d.gun).toLocaleDateString("tr-TR")}: ${sayi(d.goruntulenme)} okuma`}
                />
                <span className="kb-num text-[10px] text-muted2">
                  {new Date(d.gun).getDate()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Cihaz dağılımı ── */}
        <Card className="p-5">
          <CardHead title="Cihaz dağılımı" />
          {cihazlar.length === 0 ? (
            <EmptyState title="Cihaz verisi yok"
              description="Site güncellendikten sonra toplanmaya başlar." />
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              {/* Halka — saf SVG */}
              <svg viewBox="0 0 42 42" className="h-32 w-32 shrink-0 -rotate-90">
                {(() => {
                  let ofs = 0;
                  return cihazlar.map((c) => {
                    const yuzde = (c.v / cihazToplam) * 100;
                    const el = (
                      <circle
                        key={c.l} cx="21" cy="21" r="15.9" fill="transparent"
                        stroke={c.c} strokeWidth="6"
                        strokeDasharray={`${yuzde} ${100 - yuzde}`}
                        strokeDashoffset={-ofs}
                      />
                    );
                    ofs += yuzde;
                    return el;
                  });
                })()}
              </svg>
              <ul className="flex min-w-[140px] flex-1 flex-col gap-2.5">
                {cihazlar.map((c) => (
                  <li key={c.l} className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.c }} />
                    <span className="flex-1">{c.l}</span>
                    <span className="kb-num font-semibold">
                      %{Math.round((c.v / cihazToplam) * 100)}
                    </span>
                    <span className="kb-num w-14 text-end text-muted2">{sayi(c.v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* ── Saat dağılımı ── */}
        <Card className="p-5">
          <CardHead title="Gün içi dağılım" desc={`${ARALIK.find((a) => a.g === gun)?.l ?? "Son 30 gün"} · Türkiye saati`} />
          {saatler.length === 0 ? (
            <EmptyState title="Veri yok" />
          ) : (
            /* Aynı gerekçe: yüzde yükseklik için kap yüksekliği şart */
            <div className="flex h-32 items-stretch gap-[3px]">
              {Array.from({ length: 24 }, (_, h) => {
                const v = saatler.find((s) => s.saat === h)?.okuma ?? 0;
                return (
                  <div key={h} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="w-full shrink-0 rounded-t-[4px] bg-ink2 transition-[height] duration-500"
                      style={{ height: `${Math.max(2, (v / saatEnYuksek) * 100)}%` }}
                      title={`${String(h).padStart(2, "0")}:00 — ${sayi(v)} okuma`}
                    />
                    {h % 6 === 0 && (
                      <span className="kb-num text-[10px] text-muted2">{h}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Ülkeler ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHead title="Nereden bakıyorlar" desc="Son 90 gün · ülkeye göre" />
          {ulkeler.length === 0 ? (
            <EmptyState title="Ülke verisi yok"
              description="Sunucun ülke başlığı göndermiyorsa boş kalır (Cloudflare gerekir)." />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ulkeler.map((u) => {
                const toplam = Math.max(1, ulkeler.reduce((n, x) => n + x.goruntulenme, 0));
                return (
                  <li key={u.ulke}>
                    <div className="mb-1 flex items-center gap-2 text-[13px]">
                      <span aria-hidden>{bayrak(u.ulke)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {ULKE_AD[u.ulke] ?? (u.ulke === "??" ? "Bilinmeyen" : u.ulke)}
                      </span>
                      <span className="kb-num font-semibold">{sayi(u.goruntulenme)}</span>
                      <span className="kb-num w-12 text-end text-[12px] text-muted2">
                        %{Math.round((u.goruntulenme / toplam) * 100)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-chip">
                      <div className="h-full rounded-full bg-solid transition-[width] duration-500"
                        style={{ width: `${(u.goruntulenme / toplam) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ── Tarayıcı ve işletim sistemi ── */}
        <Card className="p-5">
          <CardHead title="Tarayıcı ve cihaz" desc="Son 90 gün" />
          {tarayicilar.length === 0 ? (
            <EmptyState title="Veri yok" />
          ) : (
            <ul className="flex flex-col">
              {tarayicilar.map((b, i) => (
                <li key={`${b.tarayici}-${b.isletim}`}
                  className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line2" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{b.tarayici}</span>
                    <span className="block text-[12px] text-muted2">{b.isletim}</span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="kb-num block text-[14px] font-semibold">
                      {sayi(b.goruntulenme)}
                    </span>
                    <span className="kb-num block text-[11px] text-muted2">
                      {sayi(b.ziyaretci)} kişi
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Giriş sayfaları ve kalma süresi ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <CardHead title="Siteye nereden giriyorlar"
            desc="Oturumun ilk açtığı sayfa · son 30 gün" />
          {girisler.length === 0 ? (
            <EmptyState title="Veri yok" />
          ) : (
            <ol className="flex flex-col">
              {girisler.map((x, i) => (
                <li key={x.yol}
                  className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line2" : ""}`}>
                  <span className="kb-num w-5 shrink-0 text-[12.5px] font-bold text-muted2">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{x.yol}</span>
                    <Badge tone="muted">{TUR_AD[x.tur] ?? x.tur}</Badge>
                  </span>
                  <span className="kb-num shrink-0 text-[14px] font-semibold">
                    {sayi(x.giris)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <CardHead title="Sayfada kalma süresi"
            desc="Ortalama saniye · %10 sn altı hemen çıkma sayılır" />
          {sureler.length === 0 ? (
            <EmptyState title="Süre verisi yok"
              description="Okurlar sayfadan çıkarken ölçülüyor; biraz zaman alır." />
          ) : (
            <ul className="flex flex-col">
              {sureler.map((s, i) => (
                <li key={s.tur}
                  className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line2" : ""}`}>
                  <span className="min-w-0 flex-1 text-[13.5px]">
                    {TUR_AD[s.tur] ?? s.tur}
                  </span>
                  <span className="kb-num shrink-0 text-end">
                    <span className="block text-[14px] font-semibold">
                      {s.ort_saniye ?? 0} sn
                    </span>
                    <span className="block text-[11px] text-muted2">
                      %{s.cikma_yuzde ?? 0} hemen çıkma
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Sayfa türleri ── */}
      <Card className="p-5">
        <CardHead title="Hangi sayfalar geziliyor"
          desc="Son 30 gün · sayfa türüne göre" />
        {turler.length === 0 ? (
          <EmptyState title="Henüz veri yok"
            description="Site güncellendikten sonra birkaç dakika içinde dolmaya başlar." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {turler.map((x) => {
              const toplam = Math.max(1, turler.reduce((n, y) => n + y.goruntulenme, 0));
              return (
                <li key={x.page_type}>
                  <div className="mb-1 flex items-center gap-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">
                      {TUR_AD[x.page_type] ?? x.page_type}
                    </span>
                    <span className="kb-num font-semibold">{sayi(x.goruntulenme)}</span>
                    <span className="kb-num w-12 text-end text-[12px] text-muted2">
                      %{Math.round((x.goruntulenme / toplam) * 100)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-chip">
                    <div className="h-full rounded-full bg-ink2 transition-[width] duration-500"
                      style={{ width: `${(x.goruntulenme / toplam) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── En çok ziyaret edilen sayfalar ── */}
      <Card className="p-5">
        <CardHead title="En çok ziyaret edilen sayfalar"
          desc={`Seçili ${gun} günlük aralıkta · haber okumasından ayrı`} />
        {sayfalar.length === 0 ? (
          <EmptyState title="Henüz ziyaret yok" />
        ) : (
          <ol className="flex flex-col">
            {sayfalar.map((s, i) => (
              <li key={s.yol}
                className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line2" : ""}`}>
                <span className="kb-num w-6 shrink-0 text-[13px] font-bold text-muted2">
                  {i + 1}
                </span>
                <a href={`${site}${s.yol}`} target="_blank" rel="noreferrer"
                  className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {s.baslik}
                  </span>
                  <span className="kb-num mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted2">
                    <Badge tone="muted">{TUR_AD[s.tur] ?? s.tur}</Badge>
                    <span className="truncate">{s.yol}</span>
                  </span>
                </a>
                <span className="shrink-0 text-end">
                  <span className="kb-num block text-[14px] font-semibold">
                    {sayi(s.goruntulenme)}
                  </span>
                  <span className="kb-num block text-[11px] text-muted2">
                    {sayi(s.ziyaretci)} kişi
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ── Trafik kaynakları ── */}
      <Card className="p-5">
        <CardHead title="Nereden geldiler"
          desc="Yönlendiren alan adı. Tam adres saklanmıyor." />
        {kaynaklar.length === 0 ? (
          <EmptyState title="Kaynak verisi yok" />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {kaynaklar.map((k) => (
              <li key={k.kaynak}>
                <div className="mb-1 flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{k.kaynak}</span>
                  <span className="kb-num font-semibold">{sayi(k.goruntulenme)}</span>
                  <span className="kb-num w-12 text-end text-[12px] text-muted2">
                    %{Math.round((k.goruntulenme / kaynakToplam) * 100)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-chip">
                  <div className="h-full rounded-full bg-solid transition-[width] duration-500"
                    style={{ width: `${(k.goruntulenme / kaynakToplam) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── En çok okunanlar ── */}
      <Card className="p-5">
        <CardHead title="En çok okunan haberler"
          desc="Sayfada 4 saniyeden fazla kalanlar — ziyaretten farklı" />
        {top.length === 0 ? (
          <EmptyState title="Bu aralıkta okunma yok" />
        ) : (
          <ol className="flex flex-col">
            {top.map((a, i) => (
              <li key={a.article_id}
                className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-line2" : ""}`}>
                <span className="kb-num w-6 shrink-0 text-[13px] font-bold text-muted2">
                  {i + 1}
                </span>
                <a href={`${site}/haber/${a.slug}`} target="_blank" rel="noreferrer"
                  className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{a.baslik}</span>
                  {a.kategori && (
                    <Badge tone="muted" className="mt-1">{a.kategori}</Badge>
                  )}
                </a>
                <span className="shrink-0 text-end">
                  <span className="kb-num block text-[14px] font-semibold">{sayi(a.okuma)}</span>
                  <span className="kb-num block text-[11px] text-muted2">
                    {sayi(a.ziyaretci)} kişi
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
