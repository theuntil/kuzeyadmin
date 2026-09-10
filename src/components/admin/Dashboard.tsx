"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import TurkeyMap from "turkey-map-react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";
import TarihAraligi from "./TarihAraligi";
import BekleyenWidget from "./BekleyenWidget";

/* ══════════════════════════════════════════════════════════════
   GÖSTERGE PANELİ

   ⚠ HARİTA "ZİYARETÇİ NEREDEN" DEĞİL.
   `page_views` tablosunda şehir kolonu yok; coğrafi konum
   çözümlemesi yapılmıyor. Harita HANGİ ŞEHRİN HABERLERİNİN
   okunduğunu gösteriyor — yerel haber sitesi için zaten daha
   anlamlı olan bu. Başlıkta da böyle yazıyor ki yanlış
   yorumlanmasın.
   ══════════════════════════════════════════════════════════════ */

type Gun = { gun: string; okuma: number; ziyaretci: number };
type Sehir = { slug: string; ad: string; plaka: number | null; okuma: number; haber: number };
type TopHaber = {
  article_id: string; slug: string; baslik: string;
  kategori: string | null; okuma: number; ziyaretci: number;
};
type Ozet = {
  bugun?: number; dun?: number; hafta?: number; oncekiHafta?: number;
  ay?: number; oncekiAy?: number; bekleyenHaber?: number; bekleyenYorum?: number;
};

/*
 * ⚠ SINIRLI SAYIM GÖSTERİMİ.
 * Büyük tablolarda sayım 10.000'de durduruluyor (bkz.
 * yama-109). Tam o değer geldiyse gerçek sayı daha büyük
 * demektir; "10.000+" yazmak yanıltıcı olmuyor.
 */
const SAYIM_SINIRI = 10000;
const sayi = (n: number) =>
  n >= SAYIM_SINIRI
    ? `${SAYIM_SINIRI.toLocaleString("tr-TR")}+`
    : n.toLocaleString("tr-TR");

/** Önceki döneme göre değişim — yönüyle birlikte */
function Fark({ simdi, onceki }: { simdi: number; onceki: number }) {
  if (!onceki) return null;
  const pct = ((simdi - onceki) / onceki) * 100;
  const artis = pct >= 0;
  return (
    <span className={`text-[12px] font-bold ${artis ? "text-emerald-500" : "text-red-500"}`}>
      {artis ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Kutu({ baslik, deger, alt, cocuk }: {
  baslik: string; deger: string; alt?: React.ReactNode; cocuk?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="text-[12.5px] text-muted2">{baslik}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="kb-num text-[26px] font-extrabold tracking-tight">{deger}</span>
        {alt}
      </div>
      {cocuk}
    </div>
  );
}

export default function Dashboard({
  siteUrl, cdnBase,
}: {
  siteUrl: string;
  /* Bekleyen işler kartındaki kapak ve avatarlar için */
  cdnBase: string;
}) {
  /*
   * Sabit 30 gün. Aralık değiştirme İstatistikler sayfasında.
   */
  const gun = 30;
  const [seri, setSeri] = useState<Gun[]>([]);
  const [sehirler, setSehirler] = useState<Sehir[]>([]);
  const [ozet, setOzet] = useState<Ozet>({});
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secili, setSecili] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  /*
   * En çok okunan haberler — kendi tarih aralığı var.
   * Gösterge panelinin geri kalanı sabit 30 gün; burada
   * yönetici bir yıla kadar geriye bakabiliyor.
   */
  const [enCok, setEnCok] = useState<TopHaber[]>([]);
  const [topBas, setTopBas] = useState<string | null>(null);
  const [topBit, setTopBit] = useState<string | null>(null);

  /*
   * ┌─ GRAFİK RENKLERİ CSS DEĞİŞKENİNDEN OKUNAMIYOR ⚠️ ─────────┐
   * │ Recharts ve harita renkleri SVG sunum özniteliği olarak   │
   * │ basılıyor; `var(--line)` gibi CSS değişkenleri orada      │
   * │ ÇÖZÜLMÜYOR. Sonuç: koyu temada grafik görünmüyor, açık    │
   * │ temada harita kayboluyordu.                                 │
   * │                                                              │
   * │ Gerçek renk değeri çalışma anında `getComputedStyle` ile  │
   * │ okunuyor ve tema değişince yeniden hesaplanıyor.           │
   * └──────────────────────────────────────────────────────────────┘
   */
  const [renk, setRenk] = useState({
    ana: "#2563eb", zemin: "#d4d4d8", metin: "#71717a",
    /* İpucu kutusu — kütüphanenin varsayılanı temaya uymuyor */
    kutuZemin: "#ffffff", kutuYazi: "#18181b",
  });

  useEffect(() => {
    const oku = () => {
      const s = getComputedStyle(document.documentElement);
      const al = (ad: string, yedek: string) =>
        s.getPropertyValue(ad).trim() || yedek;
      const koyu = document.documentElement.dataset.theme === "dark";
      setRenk({
        ana:   al("--ink", koyu ? "#f4f4f5" : "#18181b"),
        zemin: al("--line", koyu ? "#27272a" : "#e4e4e7"),
        metin: al("--muted2", koyu ? "#a1a1aa" : "#71717a"),
        kutuZemin: al("--surface", koyu ? "#18181b" : "#ffffff"),
        kutuYazi:  al("--ink", koyu ? "#f4f4f5" : "#18181b"),
      });
    };
    oku();
    const g = new MutationObserver(oku);
    g.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "class"],
    });
    return () => g.disconnect();
  }, []);

  const getir = useCallback(async () => {
    setYukleniyor(true);
    const sb = supabaseBrowser();
    const bas = new Date(Date.now() - (gun - 1) * 86400000)
      .toISOString().slice(0, 10);
    const bit = new Date().toISOString().slice(0, 10);

    const [s, sh, oz] = await Promise.all([
      sb.rpc("admin_gunluk_seri", { p_bas: bas, p_bit: bit }),
      sb.rpc("admin_sehir_trafik", { p_gun: gun }),
      sb.rpc("admin_ozet_sayilar"),
    ]);

    setYukleniyor(false);

    /*
     * ┌─ HATALAR SESSİZCE YUTULUYORDU ⚠️ ─────────────────────────┐
     * │ İlk hâli yalnızca `data` okuyup `error` alanına hiç       │
     * │ bakmıyordu. Fonksiyon yoksa, yetki reddedilirse ya da     │
     * │ parametre uyuşmazsa ekran SIFIR gösteriyor ve sebebi     │
     * │ hiçbir yerde görünmüyordu.                                  │
     * │                                                              │
     * │ Artık hata ekranda yazıyor: "veri yok" ile "sorgu         │
     * │ başarısız" birbirinden ayrılıyor.                          │
     * └──────────────────────────────────────────────────────────────┘
     */
    const hatalar = [s.error, sh.error, oz.error]
      .filter(Boolean)
      .map((e) => e!.message);
    setHata(hatalar.length ? hatalar.join(" · ") : null);

    /*
     * ┌─ SAYILAR METİN GELEBİLİYOR ⚠️ ────────────────────────────┐
     * │ Postgres `bigint` (int8) değerleri JSON'a METİN olarak    │
     * │ serileştiriliyor — JavaScript'in sayı aralığı int8'i      │
     * │ karşılamadığı için bu doğru bir davranış.                  │
     * │                                                              │
     * │ Ama grafik kütüphanesi metin değeri çizemiyor ve tüm      │
     * │ çubukları SIFIR yüksekliğinde gösteriyordu. "En çok       │
     * │ okunan şehirler" hep boş görünmesinin sebebi buydu.        │
     * │                                                              │
     * │ Sayıya çevriliyor: okuma sayıları int8 aralığını asla    │
     * │ zorlamayacak büyüklükte.                                    │
     * └──────────────────────────────────────────────────────────────┘
     */
    setSeri(((s.data ?? []) as Gun[]).map((g) => ({
      ...g,
      okuma: Number(g.okuma ?? 0),
      ziyaretci: Number(g.ziyaretci ?? 0),
    })));

    setSehirler(((sh.data ?? []) as Sehir[]).map((x) => ({
      ...x,
      okuma: Number(x.okuma ?? 0),
      haber: Number(x.haber ?? 0),
      plaka: x.plaka === null ? null : Number(x.plaka),
    })));

    const o = (oz.data ?? {}) as Record<string, unknown>;
    setOzet(Object.fromEntries(
      Object.entries(o).map(([ad, v]) => [ad, Number(v ?? 0)]),
    ) as Ozet);
  }, [gun]);

  useEffect(() => { void getir(); }, [getir]);

  /*
   * ⚠ AYRI ÇAĞRI.
   * Ana veriyle birlikte çekilseydi tarih aralığı değişince
   * harita ve grafikler de yeniden yüklenirdi.
   */
  const topGetir = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data } = topBas && topBit
      ? await sb.rpc("admin_stats_top_aralik",
          { p_bas: topBas, p_bit: topBit, p_limit: 5 })
      : await sb.rpc("admin_stats_top", { p_gun: 30, p_limit: 5 });

    setEnCok(((data ?? []) as TopHaber[]).map((x) => ({
      ...x, okuma: Number(x.okuma ?? 0), ziyaretci: Number(x.ziyaretci ?? 0),
    })));
  }, [topBas, topBit]);

  useEffect(() => { void topGetir(); }, [topGetir]);

  /* Plaka → okuma; harita boyaması bundan besleniyor */
  const plakaOkuma = useMemo(() => {
    const m = new Map<number, Sehir>();
    for (const s of sehirler) if (s.plaka) m.set(s.plaka, s);
    return m;
  }, [sehirler]);

  /*
   * ┌─ OKUMA YOKKEN HARİTA BOŞ GÖRÜNÜYORDU ⚠️ ──────────────────┐
   * │ Yoğunluk yalnızca okuma sayısına bakıyordu. Yeni kurulan  │
   * │ ya da izlemenin yeni başladığı bir sitede tüm iller sıfır │
   * │ oluyor ve harita ölü görünüyordu.                          │
   * │                                                              │
   * │ Hiç okuma yoksa HABER SAYISINA düşülüyor: "hangi şehirden │
   * │ kaç haber var" da anlamlı bir bilgi. Başlık da buna göre  │
   * │ değişiyor ki okur neye baktığını bilsin.                    │
   * └──────────────────────────────────────────────────────────────┘
   */
  const toplamOkuma = useMemo(
    () => sehirler.reduce((n, s) => n + s.okuma, 0),
    [sehirler],
  );
  const olcu: "okuma" | "haber" = toplamOkuma > 0 ? "okuma" : "haber";

  const enYuksek = useMemo(
    () => Math.max(1, ...sehirler.map((s) => s[olcu])),
    [sehirler, olcu],
  );

  const grafikVeri = seri.map((d) => ({
    ...d,
    etiket: new Date(d.gun).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
  }));

  const enCokSehir = sehirler
    .filter((s) => s[olcu] > 0)
    .sort((a, b) => b[olcu] - a[olcu])
    .slice(0, 8);

  /*
   * ┌─ "YÜKLENİYOR…" YERİNE İSKELET ⚠️ ─────────────────────────┐
   * │ Metin, veri gelince yerini büyük kartlara bırakıyor ve   │
   * │ sayfa zıplıyordu. İskelet gerçek yerleşimle aynı         │
   * │ yükseklikte: veri geldiğinde hiçbir şey kaymıyor.        │
   * └──────────────────────────────────────────────────────────────┘
   */
  if (yukleniyor && seri.length === 0) {
    return (
      <div className="grid gap-5" aria-hidden>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>

        <div className="h-[316px] animate-pulse rounded-2xl bg-surface2" />

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-[420px] animate-pulse rounded-2xl bg-surface2" />
          <div className="h-[420px] animate-pulse rounded-2xl bg-surface2" />
        </div>

        <div className="h-[340px] animate-pulse rounded-2xl bg-surface2" />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/*
        ⚠ TARİH ARALIĞI DÜĞMELERİ KALDIRILDI.
        Ayrıntılı inceleme İstatistikler sayfasında yapılıyor ve
        orada tam bir tarih seçici var. Panelde iki ayrı aralık
        denetimi olması hangisinin geçerli olduğunu belirsiz
        kılıyordu.

        Gösterge paneli sabit 30 günlük görünüm veriyor: "bugün
        durum ne" sorusunun cevabı.
      */}

      {hata && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12.5px]">
          <strong>Veri alınamadı.</strong> {hata}
          <div className="mt-1 text-muted2">
            SQL yaması yüklenmemiş olabilir (yama-107).
          </div>
        </div>
      )}

      {/* ---- özet kutular ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kutu baslik="Bugün okunma" deger={sayi(ozet.bugun ?? 0)}
          alt={<Fark simdi={ozet.bugun ?? 0} onceki={ozet.dun ?? 0} />} />
        <Kutu baslik="Son 7 gün" deger={sayi(ozet.hafta ?? 0)}
          alt={<Fark simdi={ozet.hafta ?? 0} onceki={ozet.oncekiHafta ?? 0} />} />
        <Kutu baslik="Son 30 gün" deger={sayi(ozet.ay ?? 0)}
          alt={<Fark simdi={ozet.ay ?? 0} onceki={ozet.oncekiAy ?? 0} />} />
        <Link href="/onay" className="rounded-2xl border border-line p-5 transition-colors hover:border-ink/25">
          <div className="flex items-center gap-2 text-[12.5px] text-muted2">
            <Icon name="news" size={14} /> Onay bekleyen
          </div>
          <div className="kb-num mt-1 text-[26px] font-extrabold">
            {sayi(ozet.bekleyenHaber ?? 0)}
          </div>
          <div className="text-[12px] text-muted2">
            {sayi(ozet.bekleyenYorum ?? 0)} yorum da bekliyor
          </div>
        </Link>
      </div>

      {/*
        Bekleyen işler — sayaçların hemen altında.
        Kart yalnızca gerçekten bekleyen iş varsa beliriyor.
      */}
      <BekleyenWidget cdnBase={cdnBase} />

      {/* ---- okunma eğrisi ---- */}
      <div className="rounded-2xl border border-line p-5">
        <div className="mb-4 text-[13px] font-bold">Okunma · son {gun} gün</div>
        {grafikVeri.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted2">
            Bu aralıkta veri yok.
          </p>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={grafikVeri} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="okumaDolgu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={renk.ana} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={renk.ana} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={renk.zemin} vertical={false} />
                <XAxis dataKey="etiket" tick={{ fontSize: 11, fill: renk.metin }} tickLine={false} axisLine={false}
                  interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: renk.metin }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  formatter={(v, ad) =>
                    [sayi(Number(v ?? 0)), ad === "okuma" ? "Okunma" : "Ziyaretçi"]}
                  contentStyle={{
                      fontSize: 12, borderRadius: 10,
                      background: renk.kutuZemin, color: renk.kutuYazi,
                      border: `1px solid ${renk.zemin}`,
                    }}
                    itemStyle={{ color: renk.kutuYazi }}
                    labelStyle={{ color: renk.metin, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="okuma" stroke={renk.ana}
                  strokeWidth={2} fill="url(#okumaDolgu)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- Türkiye haritası ---- */}
        <div className="rounded-2xl border border-line p-5">
          <div className="text-[13px] font-bold">Şehirlere göre okunma</div>
          <p className="mb-3 text-[12px] text-muted2">
            {/*
              ⚠ BAŞLIK YANILTMAMALI.
              Bu harita ziyaretçinin konumunu değil, okunan
              haberin şehrini gösteriyor.
            */}
            {olcu === "okuma"
              ? "Haberin ilgili olduğu şehre göre okunma. Bir ile tıklayın."
              : "Henüz okunma verisi yok — şehir başına haber sayısı gösteriliyor."}
          </p>

          <div className="kb-harita">
            <TurkeyMap
              hoverable
              showTooltip
              /*
               * ┌─ HARİTA GÖRÜNMÜYORDU ⚠️ ────────────────────────┐
               * │ Boş il rengi olarak `--line` kullanılmıştı.    │
               * │ O değişken açık temada #f2f2f2 (neredeyse      │
               * │ beyaz), koyu temada #080808 (neredeyse siyah)  │
               * │ — yani her iki temada da zeminle aynı renk.    │
               * │ Harita vardı ama görünmüyordu.                  │
               * │                                                  │
               * │ Artık tek renk (`--ink`) üzerinden ısı        │
               * │ haritası: yoğunluk OPAKLIKLA veriliyor. Her    │
               * │ ilin en az %10 opaklığı var, yani sınırlar    │
               * │ her zaman seçiliyor.                            │
               * └──────────────────────────────────────────────────┘
               */
              customStyle={{ idleColor: renk.ana, hoverColor: renk.ana }}
              /*
               * ┌─ TIKLAMA ÇALIŞMIYORDU ⚠️ ────────────────────────┐
               * │ Tıklamayı `cityWrapper` içindeki `<g>` öğesine  │
               * │ koymuştum. Kütüphane il yollarını kendi olay    │
               * │ katmanıyla çiziyor ve o katman tıklamayı        │
               * │ tüketiyor — sarmalayıcıya hiç ulaşmıyordu.      │
               * │                                                    │
               * │ Kütüphanenin kendi `onClick` desteği var; doğru │
               * │ yol bu.                                            │
               * └────────────────────────────────────────────────────┘
               */
              onClick={(city) => {
                const s = plakaOkuma.get(city.plateNumber);
                if (s) setSecili(s.slug);
              }}
              /*
               * ⚠ PARAMETRE SIRASI: ÖNCE ÖĞE, SONRA ŞEHİR.
               * Ters yazılmıştı; tip denetimi yakaladı.
               */
              cityWrapper={(el, city) => {
                const s = plakaOkuma.get(city.plateNumber);
                const yogunluk = s ? s[olcu] / enYuksek : 0;
                return (
                  <g
                    key={city.plateNumber}
                    style={{
                      cursor: s?.[olcu] ? "pointer" : "default",
                      transition: "opacity .15s ease",
                      /*
                       * Yoğunluk opaklıkla veriliyor: tek renk
                       * tonlaması hem tema uyumlu hem okunaklı.
                       * Sıfır okumada çok soluk ama görünür.
                       */
                      /*
                       * Okuma yoksa %10 — il yine de görünüyor.
                       * En yoğun il tam opaklıkta.
                       */
                      opacity: s?.[olcu] ? 0.28 + yogunluk * 0.72 : 0.1,
                      fill: renk.ana,
                    }}
                  >
                    {el}
                  </g>
                );
              }}
            />
          </div>
        </div>

        {/* ---- en çok okunan şehirler ---- */}
        <div className="rounded-2xl border border-line p-5">
          <div className="mb-4 text-[13px] font-bold">
            {olcu === "okuma" ? "En çok okunan şehirler" : "En çok haber girilen şehirler"}
          </div>
          {enCokSehir.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted2">Henüz veri yok.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={enCokSehir} layout="vertical"
                  margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="ad" width={86}
                    tick={{ fontSize: 11.5, fill: renk.metin }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v) => [sayi(Number(v ?? 0)),
                      olcu === "okuma" ? "Okunma" : "Haber"]}
                    contentStyle={{
                      fontSize: 12, borderRadius: 10,
                      background: renk.kutuZemin, color: renk.kutuYazi,
                      border: `1px solid ${renk.zemin}`,
                    }}
                    itemStyle={{ color: renk.kutuYazi }}
                    labelStyle={{ color: renk.metin, fontSize: 12 }}
                  />
                  <Bar dataKey={olcu} fill={renk.ana} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ---- en çok okunan haberler ---- */}
      <div className="rounded-2xl border border-line p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-bold">En çok okunan haberler</div>
            <p className="text-[12px] text-muted2">
              {topBas && topBit ? `${topBas} → ${topBit}` : "Son 30 gün"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {topBas && topBit && (
              <button
                type="button"
                onClick={() => { setTopBas(null); setTopBit(null); }}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold"
              >
                Sıfırla
              </button>
            )}
            <TarihAraligi
              bas={topBas ?? new Date(Date.now() - 29 * 86400000)
                .toISOString().slice(0, 10)}
              bit={topBit ?? new Date().toISOString().slice(0, 10)}
              onSec={(b, s) => { setTopBas(b); setTopBit(s); }}
            />
          </div>
        </div>

        {enCok.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted2">
            Bu aralıkta okunma verisi yok.
          </p>
        ) : (
          <ol className="grid gap-2">
            {enCok.map((h, i) => (
              <li
                key={h.article_id}
                className="flex items-center gap-3 rounded-xl border border-line p-3"
              >
                <span className="kb-num w-5 shrink-0 text-center text-[13px] font-bold text-muted2">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {h.baslik}
                  </span>
                  {h.kategori && (
                    <span className="text-[11.5px] text-muted2">{h.kategori}</span>
                  )}
                </span>
                <span className="kb-num shrink-0 text-[13px] font-bold">
                  {sayi(h.okuma)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {secili && (
        <SehirDetay slug={secili} gun={gun} siteUrl={siteUrl} renk={renk}
          onKapat={() => setSecili(null)} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ŞEHİR DETAYI — yandan açılan panel
   ══════════════════════════════════════════════════════════════ */

type Detay = {
  bulundu?: boolean; ad?: string; toplamHaber?: number; yayinda?: number;
  okuma?: number; yorum?: number;
  gunluk?: { gun: string; okuma: number }[];
  enCok?: { id: string; slug: string; baslik: string; okuma: number }[];
};

function SehirDetay({ slug, gun, siteUrl, renk, onKapat }: {
  slug: string; gun: number; siteUrl: string;
  /* Tema renkleri üst bileşenden geliyor — SVG'de CSS değişkeni çözülmüyor */
  renk: {
    ana: string; zemin: string; metin: string;
    kutuZemin: string; kutuYazi: string;
  };
  onKapat: () => void;
}) {
  const [d, setD] = useState<Detay | null>(null);
  const [acik, setAcik] = useState(false);

  /*
   * İki kare bekleniyor: öğe önce kapalı konumda basılmalı,
   * sonra açık sınıfı eklenmeli. Aksi hâlde tarayıcı geçişi
   * hiç çalıştırmıyor.
   */
  useEffect(() => {
    const z = requestAnimationFrame(() => setAcik(true));
    return () => cancelAnimationFrame(z);
  }, []);

  /* Kapanış animasyonu bitene kadar bekleniyor */
  const kapat = () => {
    setAcik(false);
    setTimeout(onKapat, 240);
  };

  useEffect(() => {
    let iptal = false;
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.rpc("admin_sehir_detay", { p_slug: slug, p_gun: gun });
      if (!iptal) setD((data ?? {}) as Detay);
    })();
    return () => { iptal = true; };
  }, [slug, gun]);

  const seri = (d?.gunluk ?? []).map((x) => ({
    ...x,
    etiket: new Date(x.gun).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
  }));

  return (
    <>
      {/*
        ⚠ ANİDEN BELİRİYORDU.
        Panel doğrudan basılıp doğrudan kaldırılıyordu; ne
        açılış ne kapanış görünüyordu. `acik` durumu geçişi
        sürüyor, `basildi` ise kapanma animasyonu bitene kadar
        öğeyi DOM'da tutuyor.
      */}
      <div
        onClick={kapat}
        aria-hidden
        className={`fixed inset-0 z-[190] bg-black/50 transition-opacity duration-200 ${
          acik ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Şehir detayı"
        className={`kb-sehir-panel fixed z-[200] overflow-y-auto border-line bg-surface p-6 ${
          acik ? "kb-acik" : ""
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-[19px] font-extrabold">{d?.ad ?? "…"}</h2>
          <button type="button" onClick={kapat} aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line">
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Kutu baslik={`Okunma (${gun} gün)`} deger={sayi(d?.okuma ?? 0)} />
          <Kutu baslik="Yayındaki haber" deger={sayi(d?.yayinda ?? 0)} />
          <Kutu baslik="Toplam haber" deger={sayi(d?.toplamHaber ?? 0)} />
          <Kutu baslik="Yorum" deger={sayi(d?.yorum ?? 0)} />
        </div>

        {seri.length > 0 && (
          <div className="mt-5 rounded-2xl border border-line p-4">
            <div className="mb-3 text-[12.5px] font-bold">Gün gün okunma</div>
            <div style={{ width: "100%", height: 150 }}>
              <ResponsiveContainer>
                <AreaChart data={seri} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <XAxis dataKey="etiket" tick={{ fontSize: 10, fill: renk.metin }} tickLine={false}
                    axisLine={false} interval="preserveStartEnd" minTickGap={26} />
                  <YAxis tick={{ fontSize: 10, fill: renk.metin }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(v) => [sayi(Number(v ?? 0)), "Okunma"]}
                    contentStyle={{
                      fontSize: 12, borderRadius: 10,
                      background: renk.kutuZemin, color: renk.kutuYazi,
                      border: `1px solid ${renk.zemin}`,
                    }}
                    itemStyle={{ color: renk.kutuYazi }}
                    labelStyle={{ color: renk.metin, fontSize: 12 }} />
                  <Area type="monotone" dataKey="okuma" stroke={renk.ana}
                    strokeWidth={2} fillOpacity={0.16} fill={renk.ana} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(d?.enCok?.length ?? 0) > 0 && (
          <div className="mt-5">
            <div className="mb-3 text-[12.5px] font-bold">En çok okunan haberler</div>
            <div className="grid gap-2">
              {d!.enCok!.map((a) => (
                <a
                  key={a.id}
                  href={`${siteUrl.replace(/\/+$/, "")}/haber/${a.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 rounded-xl border border-line p-3 text-[13px]"
                >
                  <span className="kb-num shrink-0 font-bold text-muted2">
                    {sayi(a.okuma)}
                  </span>
                  <span className="min-w-0 flex-1">{a.baslik}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
