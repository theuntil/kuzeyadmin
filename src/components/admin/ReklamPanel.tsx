"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import Icon from "@/components/ui/Icon";
import { r2Yukle } from "@/lib/upload";
import { gorseliKucult } from "@/lib/gorsel";
import { Anahtar } from "@/components/ui/Anahtar";

/* ══════════════════════════════════════════════════════════════
   REKLAM YÖNETİMİ

   İki ayrı sistem tek ekranda, sekmelerle ayrılmış:

   • ŞERİT   — sayfa kenarlarındaki dikey sütun, döngü hâlinde
   • BANTLAR — belirli üç noktada tek yatay reklam

   ⚠ KARIŞTIRILMAMALI.
   Şeride kaç reklam eklenirse hepsi sırayla akıyor. Bantta
   yalnızca ilki gösteriliyor — o yer tek bir reklam için.
   ══════════════════════════════════════════════════════════════ */

interface Reklam {
  id: string;
  tur: string;
  yer: string;
  gorsel_key: string;
  mobil_key: string | null;
  hedef_url: string;
  not_metni: string | null;
  aktif: boolean;
  sira: number;
  goruntulenme: number;
  tiklama: number;
}

/*
 * ┌─ İKİ BÖLÜM, DÖRT DEĞİL ⚠️ ─────────────────────────────────┐
 * │ Önce her bant yeri ayrı sekmeydi. Ama üç bant yerinin       │
 * │ mantığı aynı: her birinde TEK reklam var. Dört sekme,       │
 * │ aslında iki farklı sistemi dört farklı şeymiş gibi          │
 * │ gösteriyordu.                                                 │
 * │                                                              │
 * │ Artık iki bölüm:                                             │
 * │   • Kayan reklamlar → şerit, sınırsız, döngü                │
 * │   • Alan reklamları → üç sabit yer, her birinde tek reklam  │
 * └──────────────────────────────────────────────────────────────┘
 */
const BANT_YERLERI = [
  { k: "article_top", ad: "Haber sayfası — üst",
    aciklama: "Uygulama rozetlerinin altında." },
  { k: "article_bottom", ad: "Haber sayfası — alt",
    aciklama: "Haber metninin bittiği yerde." },
  { k: "home_top", ad: "Ana sayfa",
    aciklama: "Vitrinin altında, öne çıkanların üstünde." },
] as const;

export default function ReklamPanel({ cdnBase }: { cdnBase: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [liste, setListe] = useState<Reklam[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [sekme, setSekme] = useState<"kayan" | "alan">("kayan");
  const [ekleAcik, setEkleAcik] = useState(false);
  /* Ekleme penceresi hangi yer için açıldı */
  const [hedefYer, setHedefYer] = useState<string>("rail");
  const [silinecek, setSilinecek] = useState<Reklam | null>(null);
  /* Karta tıklayınca açılan ayrıntı penceresi */
  const [detay, setDetay] = useState<Reklam | null>(null);
  /* Düzenleme penceresi — yeni ekleme ile aynı form, dolu gelir */
  const [duzenlenen, setDuzenlenen] = useState<Reklam | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  /*
   * ⚠ ANAHTARLAR BURADA DA.
   * Ayarlar sayfasında da var ama reklam yönetirken oraya gidip
   * gelmek gereksiz. İki yer de aynı alanı yazıyor.
   */
  const [railAcik, setRailAcik] = useState(true);
  const [bantAcik, setBantAcik] = useState(true);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_reklam_liste");
    setYukleniyor(false);
    if (error) { t.error("Liste okunamadı: " + error.message); return; }
    setListe((data ?? []) as Reklam[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  useEffect(() => {
    void (async () => {
      /*
       * ⚠ GÖRÜNÜM ÜZERİNDEN OKUNUYOR.
       * `site_settings` tablosuna doğrudan erişim yönetici
       * dışında kapalı; görünüm zaten bu iki alanı taşıyor.
       */
      const { data } = await sb
        .from("public_site_settings")
        .select("ads_rail_enabled, ads_banner_enabled")
        .maybeSingle();
      if (!data) return;
      setRailAcik(Boolean(data.ads_rail_enabled));
      setBantAcik(Boolean(data.ads_banner_enabled));
    })();
  }, [sb]);

  async function anahtarDegis(alan: string, deger: boolean) {
    /* İyimser: anahtar hemen dönüyor, hata olursa geri alınıyor */
    if (alan === "ads_rail_enabled") setRailAcik(deger);
    else setBantAcik(deger);

    /*
     * ┌─ TABLOYA DOĞRUDAN YAZILIYORDU ⚠️ ──────────────────────────┐
     * │ `.neq("id", "0000…")` yazmıştım. Ama `site_settings`      │
     * │ tek satırlık bir tablo ve `id` kolonu BOOLEAN — UUID ile │
     * │ karşılaştırınca şu hatayı veriyordu:                       │
     * │   invalid input syntax for type boolean: "00000000-…"     │
     * │                                                              │
     * │ Panelin geri kalanı zaten `admin_update_settings` RPC'sini│
     * │ kullanıyor; o fonksiyon yetkiyi de denetliyor.             │
     * └──────────────────────────────────────────────────────────────┘
     */
    const { error } = await sb.rpc("admin_update_settings", {
      p_patch: { [alan]: deger },
    });

    if (error) {
      if (alan === "ads_rail_enabled") setRailAcik(!deger);
      else setBantAcik(!deger);
      t.error(error.message);
    }
  }

  const kayanlar = liste.filter((r) => r.yer === "rail");

  async function durum(r: Reklam) {
    const { error } = await sb.rpc("admin_reklam_guncelle", {
      p: { id: r.id, aktif: !r.aktif },
    });
    if (error) { t.error(error.message); return; }
    await yukle();
  }

  async function sil() {
    if (!silinecek) return;
    setSiliniyor(true);
    const { error } = await sb.rpc("admin_reklam_sil", { p_id: silinecek.id });
    setSiliniyor(false);
    if (error) { t.error(error.message); return; }
    t.success("Reklam silindi");
    setSilinecek(null);
    await yukle();
  }

  /**
   * Sırayı bir basamak taşır.
   *
   * ⚠ YALNIZCA ŞERİTTE ANLAMLI.
   * Bant yerlerinde tek reklam gösteriliyor; sıralama orada
   * hangisinin yayında olduğunu belirliyor.
   */
  async function tasi(r: Reklam, yon: -1 | 1) {
    const i = kayanlar.findIndex((x) => x.id === r.id);
    const hedef = kayanlar[i + yon];
    if (!hedef) return;

    await Promise.all([
      sb.rpc("admin_reklam_guncelle", { p: { id: r.id, sira: hedef.sira } }),
      sb.rpc("admin_reklam_guncelle", { p: { id: hedef.id, sira: r.sira } }),
    ]);
    await yukle();
  }

  return (
    <div className="grid gap-5">
      {/* ---- iki bölüm ---- */}
      <div className="flex flex-wrap gap-2">
        {/*
          ⚠ SAYI GÖSTERİLMİYOR.
          "(1)" gibi rakamlar sekmeyi kalabalıklaştırıyordu ve
          zaten altta liste duruyor. İkon hangi bölüm olduğunu
          rakamdan hızlı anlatıyor.
        */}
        {([
          { k: "kayan", ad: "Kayan reklamlar", ikon: "refresh" as const },
          { k: "alan", ad: "Alan reklamları", ikon: "grid" as const },
        ] as const).map((b) => (
          <button
            key={b.k}
            type="button"
            onClick={() => setSekme(b.k)}
            className={`kb-lift flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
              sekme === b.k
                ? "bg-solid text-on-solid"
                : "bg-chip text-ink2 hover:text-ink"
            }`}
          >
            <Icon name={b.ikon} size={15} />
            {b.ad}
          </button>
        ))}
      </div>

      {sekme === "kayan" ? (
        <div className="rounded-2xl border border-line p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold">Kayan reklamlar</span>
                <Anahtar
                  acik={railAcik}
                  onDegis={(v) => void anahtarDegis("ads_rail_enabled", v)}
                />
              </div>
              <p className="mt-1 max-w-[560px] text-[12.5px] leading-relaxed text-muted2">
                Geniş ekranda sayfanın iki yanında dikey akar. Dar ekranda
                içeriğin üstünde yatay şerit olur. Kaç reklam eklersen
                hepsi döngüyle gösterilir.
              </p>
            </div>

            <button
              type="button"
              onClick={() => { setHedefYer("rail"); setEkleAcik(true); }}
              aria-label="Reklam ekle"
              title="Reklam ekle"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg"
            >
              <Icon name="plus" size={18} />
            </button>
          </div>

          {yukleniyor ? (
            <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-surface2" />
              ))}
            </div>
          ) : kayanlar.length === 0 ? (
            <p className="py-10 text-center text-[13.5px] text-muted2">
              Kayan reklam yok.
            </p>
          ) : (
            /*
              ⚠ SATIRDA 3 / 5.
              Mobilde üç, masaüstünde beş. Kartlar küçük ve
              sade; ayrıntı ve düzenleme karta tıklayınca
              açılan pencerede.
            */
            <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-5">
              {kayanlar.map((r) => (
                <MiniKart
                  key={r.id}
                  r={r}
                  cdn={cdn}
                  onAc={() => setDetay(r)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /*
         * ⚠ HER ALANDA TEK REKLAM.
         * Bu üç yerde sitede yalnızca bir reklam gösteriliyor.
         * "Ekle" düğmesi yerine doğrudan o alanın kartı
         * duruyor: doluysa değiştir, boşsa yükle.
         */
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4">
            <div className="min-w-0">
              <div className="text-[13px] font-bold">Alan reklamları</div>
              <p className="mt-0.5 text-[12px] text-muted2">
                Kapatınca aşağıdaki üç alan da sitede gösterilmez.
              </p>
            </div>
            <Anahtar
              acik={bantAcik}
              onDegis={(v) => void anahtarDegis("ads_banner_enabled", v)}
            />
          </div>

          {BANT_YERLERI.map((y) => {
            const r = liste.find((x) => x.yer === y.k) ?? null;
            return (
              <AlanKart
                key={y.k}
                ad={y.ad}
                aciklama={y.aciklama}
                r={r}
                cdn={cdn}
                onEkle={() => {
                  /*
                   * ⚠ DOLUYSA DÜZENLEME, BOŞSA EKLEME.
                   * "Değiştir" yeni kayıt formu açıyordu; mevcut
                   * adres ve not kayboluyordu.
                   */
                  if (r) setDuzenlenen(r);
                  else { setHedefYer(y.k); setEkleAcik(true); }
                }}
                onDurum={() => r && void durum(r)}
                onSil={() => r && setSilinecek(r)}
              />
            );
          })}
        </div>
      )}

      {ekleAcik && (
        <EklePenceresi
          yer={hedefYer}
          bantMi={hedefYer !== "rail"}
          cdnBase={cdnBase}
          onKapat={() => setEkleAcik(false)}
          onEklendi={async () => {
            /*
             * ⚠ ALAN REKLAMINDA ESKİSİ SİLİNİYOR.
             * Bu üç yerde sitede tek reklam gösteriliyor.
             * Eskisi kalsaydı panelde iki kayıt birikir, hangisinin
             * yayında olduğu belirsizleşirdi.
             */
            if (hedefYer !== "rail") {
              const eski = liste.find((x) => x.yer === hedefYer);
              if (eski) {
                await sb.rpc("admin_reklam_sil", { p_id: eski.id });
              }
            }
            setEkleAcik(false);
            await yukle();
          }}
        />
      )}

      {duzenlenen && (
        <EklePenceresi
          yer={duzenlenen.yer}
          bantMi={duzenlenen.yer !== "rail"}
          cdnBase={cdnBase}
          mevcut={duzenlenen}
          onKapat={() => setDuzenlenen(null)}
          onEklendi={async () => { setDuzenlenen(null); await yukle(); }}
        />
      )}

      {detay && (
        <DetayPenceresi
          r={detay}
          cdn={cdn}
          ilk={kayanlar.findIndex((x) => x.id === detay.id) === 0}
          son={kayanlar.findIndex((x) => x.id === detay.id) === kayanlar.length - 1}
          onKapat={() => setDetay(null)}
          onDurum={async () => { await durum(detay); setDetay(null); }}
          onSil={() => { setSilinecek(detay); setDetay(null); }}
          onDuzenle={() => { setDuzenlenen(detay); setDetay(null); }}
          onYukari={async () => { await tasi(detay, -1); setDetay(null); }}
          onAsagi={async () => { await tasi(detay, 1); setDetay(null); }}
        />
      )}

      <ConfirmDialog
        open={Boolean(silinecek)}
        title="Reklam silinsin mi?"
        description="Bu reklam sitede artık gösterilmez. İşlem geri alınamaz."
        confirmLabel="Sil"
        loading={siliniyor}
        onConfirm={() => void sil()}
        onClose={() => setSilinecek(null)}
      />
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   EKLEME PENCERESİ
   ══════════════════════════════════════════════════════════════ */

function EklePenceresi({
  yer, bantMi, cdnBase, onKapat, onEklendi, mevcut = null,
}: {
  yer: string;
  /** Bant yerlerinde mobil görsel de yüklenebiliyor */
  bantMi: boolean;
  cdnBase: string;
  onKapat: () => void;
  onEklendi: () => void;
  /*
   * ⚠ AYNI FORM, İKİ İŞ.
   * Dolu gelirse düzenleme, boş gelirse ekleme. İki ayrı
   * pencere yazmak aynı alanları iki yerde bakım demekti.
   */
  mevcut?: Reklam | null;
}) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [gorsel, setGorsel] = useState<string | null>(mevcut?.gorsel_key ?? null);
  const [mobil, setMobil] = useState<string | null>(mevcut?.mobil_key ?? null);
  const [url, setUrl] = useState(mevcut?.hedef_url ?? "");
  const [notu, setNotu] = useState(mevcut?.not_metni ?? "");
  const [yuklenen, setYuklenen] = useState<"masaustu" | "mobil" | null>(null);
  const [ekliyor, setEkliyor] = useState(false);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    const z = requestAnimationFrame(() => setAcik(true));
    return () => cancelAnimationFrame(z);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  const cdn = cdnBase.replace(/\/+$/, "");
  const gecerli = Boolean(gorsel) && /^https?:\/\//i.test(url.trim());

  async function dosyaYukle(f: File, hangi: "masaustu" | "mobil") {
    if (!f.type.startsWith("image/")) {
      t.error("Yalnızca görsel yükleyebilirsin");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      t.error("Dosya 8 MB'den büyük olamaz");
      return;
    }

    setYuklenen(hangi);
    try {
      /* Yüklemeden önce küçültülüyor — sayfa hızı için */
      const kucuk = await gorseliKucult(f);
      const { key } = await r2Yukle(kucuk, "reklam", f.name);
      if (hangi === "mobil") setMobil(key);
      else setGorsel(key);
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setYuklenen(null);
    }
  }

  async function ekle() {
    if (!gecerli || ekliyor) return;
    setEkliyor(true);

    const govde = {
      gorsel_key: gorsel,
      mobil_key: mobil,
      hedef_url: url.trim(),
      not_metni: notu.trim() || null,
    };

    const { error } = mevcut
      ? await sb.rpc("admin_reklam_guncelle", {
          p: { ...govde, id: mevcut.id },
        })
      : await sb.rpc("admin_reklam_ekle", {
          p: { ...govde, tur: yer === "rail" ? "rail" : "banner", yer },
        });
    setEkliyor(false);

    if (error) { t.error(error.message); return; }
    t.success(mevcut ? "Güncellendi" : "Reklam eklendi");
    onEklendi();
  }

  return (
    <>
      <div
        onClick={onKapat}
        aria-hidden
        className={`fixed inset-0 z-[190] bg-black/50 transition-opacity duration-200 ${
          acik ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reklam ekle"
        className={`kb-qr-pencere fixed z-[200] max-h-[88vh] overflow-y-auto bg-surface p-6 ${
          acik ? "kb-acik" : ""
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">
            {mevcut ? "Reklamı düzenle" : "Reklam ekle"}
          </h2>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/*
          ⚠ İÇ İÇE PENCERE KALDIRILDI.
          Önce "Ekle" penceresi açılıyor, oradan "Görsel yükle"
          ikinci bir pencere açıyordu. İki katmanlı pencere
          nereye tıklandığını takip etmeyi zorlaştırıyordu.

          Artık dosya seçici doğrudan açılıyor; yükleme burada
          bitiyor.
        */}
        <label className="mb-1.5 block text-[12.5px] font-semibold">
          Görsel <span className="font-normal text-muted2">— zorunlu</span>
        </label>
        <GorselAlan
          anahtar={gorsel}
          cdn={cdn}
          bantMi={bantMi}
          yukleniyor={yuklenen === "masaustu"}
          onSec={(f) => void dosyaYukle(f, "masaustu")}
          onKaldir={() => setGorsel(null)}
        />

        {bantMi && (
          <>
            <label className="mb-1.5 block text-[12.5px] font-semibold">
              Mobil görseli{" "}
              <span className="font-normal text-muted2">— isteğe bağlı</span>
            </label>
            <GorselAlan
              anahtar={mobil}
              cdn={cdn}
              bantMi
              yukleniyor={yuklenen === "mobil"}
              onSec={(f) => void dosyaYukle(f, "mobil")}
              onKaldir={() => setMobil(null)}
            />
            <p className="mb-4 text-[12px] text-muted2">
              Yüklenmezse dar ekranda masaüstü görseli kullanılır.
            </p>
          </>
        )}

        <label className="mb-1.5 block text-[12.5px] font-semibold">
          Hedef adres
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          inputMode="url"
          className="mb-4 w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
        />

        <label className="mb-1.5 block text-[12.5px] font-semibold">
          İç not <span className="font-normal text-muted2">— sadece sen görürsün</span>
        </label>
        <textarea
          value={notu}
          onChange={(e) => setNotu(e.target.value)}
          rows={3}
          placeholder="Müşteri adı, sözleşme tarihi, ücret…"
          className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onKapat}
            disabled={ekliyor}
            className="rounded-lg border border-line px-4 py-2.5 text-[13px] font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void ekle()}
            disabled={!gecerli || ekliyor}
            className="rounded-lg bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-40"
          >
            {ekliyor ? "Kaydediliyor…" : mevcut ? "Kaydet" : "Ekle"}
          </button>
        </div>
      </div>

    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   ALAN KARTI

   Üç sabit bant yerinden biri. Sitede yalnızca bir reklam
   gösterildiği için liste değil, tek bir yuva olarak duruyor.
   ══════════════════════════════════════════════════════════════ */

function AlanKart({
  ad, aciklama, r, cdn, onEkle, onDurum, onSil,
}: {
  ad: string;
  aciklama: string;
  r: Reklam | null;
  cdn: string;
  onEkle: () => void;
  onDurum: () => void;
  onSil: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-bold">{ad}</div>
          <p className="mt-0.5 text-[12px] text-muted2">{aciklama}</p>
        </div>

        {r ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {/*
              ⚠ ROZET YERİNE ANAHTAR.
              "Yayında" yazan metin rozeti kaldırıldı ama aç/kapa
              yeteneği kalmamıştı — alan reklamı bir daha
              kapatılamıyordu. Anahtar hem durumu gösteriyor hem
              değiştiriyor.
            */}
            <Anahtar acik={r.aktif} onDegis={onDurum} />

            <button
              type="button"
              onClick={onEkle}
              aria-label="Düzenle"
              title="Düzenle"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line"
            >
              <Icon name="edit" size={14} />
            </button>

            <button
              type="button"
              onClick={onSil}
              aria-label="Kaldır"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 text-red-500"
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEkle}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[12.5px] font-bold text-bg"
          >
            <Icon name="plus" size={14} /> Görsel yükle
          </button>
        )}
      </div>

      {r ? (
        <>
          {/*
            ⚠ SİTEDEKİ ORANDA ÖNİZLEME.
            Bant sitede ince bir şerit; panelde 4:3 göstermek
            yanıltıcı olurdu.
          */}
          <div className="mb-2 h-[110px] overflow-hidden rounded-lg bg-chip">
                <img
              src={`${cdn}/${r.gorsel_key}`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>

          <a
            href={r.hedef_url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[12px] font-semibold hover:underline"
          >
            {r.hedef_url}
          </a>

          {r.not_metni && (
            <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted2">
              {r.not_metni}
            </p>
          )}
        </>
      ) : (
        <div className="grid h-[110px] place-items-center rounded-lg border border-dashed border-line text-[12px] text-muted2">
          Bu alan boş — sitede hiçbir şey gösterilmiyor
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   GÖRSEL ALANI

   Tek adımda yükleme: tıkla, dosya seç, bitti. Ayrı bir
   pencere açılmıyor.
   ══════════════════════════════════════════════════════════════ */

function GorselAlan({
  anahtar, cdn, bantMi, yukleniyor, onSec, onKaldir,
}: {
  anahtar: string | null;
  cdn: string;
  /** Bant görselleri ince; önizleme de öyle olmalı */
  bantMi: boolean;
  yukleniyor: boolean;
  onSec: (f: File) => void;
  onKaldir: () => void;
}) {
  const girdi = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4">
      <div
        className={`relative overflow-hidden rounded-xl border border-line bg-chip ${
          bantMi ? "h-[110px]" : "aspect-[4/3]"
        }`}
      >
        {anahtar ? (
          <img
            src={`${cdn}/${anahtar}`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => girdi.current?.click()}
            disabled={yukleniyor}
            className="flex h-full w-full items-center justify-center gap-2 text-[12.5px] font-semibold text-muted2"
          >
            {yukleniyor ? (
              "Yükleniyor…"
            ) : (
              <>
                <Icon name="camera" size={15} /> Görsel seç
              </>
            )}
          </button>
        )}

        {anahtar && (
          <div className="absolute end-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => girdi.current?.click()}
              className="rounded-lg bg-page/85 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur"
            >
              Değiştir
            </button>
            <button
              type="button"
              onClick={onKaldir}
              aria-label="Kaldır"
              className="rounded-lg bg-page/85 px-2 py-1 text-[11.5px] font-semibold text-red-500 backdrop-blur"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <input
        ref={girdi}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSec(f);
          /* Aynı dosya tekrar seçilebilsin diye sıfırlanıyor */
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MİNİ KART

   ⚠ ÜSTÜNDE İŞLEM DÜĞMESİ YOK.
   Beş kart yan yana dururken her birine üç düğme koymak
   ızgarayı okunmaz yapıyordu. Kart tıklanınca ayrıntı
   penceresi açılıyor; bütün işlemler orada.
   ══════════════════════════════════════════════════════════════ */

function MiniKart({
  r, cdn, onAc,
}: { r: Reklam; cdn: string; onAc: () => void }) {
  return (
    <button
      type="button"
      onClick={onAc}
      className={`group relative overflow-hidden rounded-xl border text-start transition-colors ${
        r.aktif ? "border-line hover:border-ink/30" : "border-line opacity-55"
      }`}
    >
      <span className="block aspect-[4/3] bg-chip">
        <img
          src={`${cdn}/${r.gorsel_key}`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>

      {!r.aktif && (
        <span className="absolute start-1.5 top-1.5 rounded-md bg-page/85 px-1.5 py-0.5 text-[10px] font-bold text-muted2 backdrop-blur">
          Kapalı
        </span>
      )}

      <span className="block truncate p-2 text-[11.5px] text-muted2">
        {r.not_metni || r.hedef_url.replace(/^https?:\/\//, "")}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   AYRINTI PENCERESİ
   ══════════════════════════════════════════════════════════════ */

function DetayPenceresi({
  r, cdn, ilk, son, onKapat, onDurum, onSil, onDuzenle, onYukari, onAsagi,
}: {
  r: Reklam; cdn: string; ilk: boolean; son: boolean;
  onKapat: () => void;
  onDurum: () => void; onSil: () => void; onDuzenle: () => void;
  onYukari: () => void; onAsagi: () => void;
}) {
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    const z = requestAnimationFrame(() => setAcik(true));
    return () => cancelAnimationFrame(z);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  return (
    <>
      <div
        onClick={onKapat}
        aria-hidden
        className={`fixed inset-0 z-[190] bg-black/50 transition-opacity duration-200 ${
          acik ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reklam ayrıntısı"
        className={`kb-qr-pencere kb-yumusak fixed z-[200] max-h-[88vh] overflow-y-auto bg-surface p-6 ${
          acik ? "kb-acik" : ""
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">Reklam</h2>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="mb-5 aspect-[4/3] overflow-hidden rounded-2xl bg-chip">
            <img
            src={`${cdn}/${r.gorsel_key}`}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        <div className="mb-1 text-[11.5px] font-bold text-muted2">
          HEDEF ADRES
        </div>
        <a
          href={r.hedef_url}
          target="_blank"
          rel="noreferrer"
          className="mb-4 block break-all text-[13px] font-semibold hover:underline"
        >
          {r.hedef_url}
        </a>

        {r.not_metni && (
          <>
            <div className="mb-1 text-[11.5px] font-bold text-muted2">
              İÇ NOT
            </div>
            <p className="mb-4 text-[13px] leading-relaxed">{r.not_metni}</p>
          </>
        )}

        <div className="mb-5 flex items-center gap-4 text-[12.5px] text-muted2">
          <span>{r.tiklama.toLocaleString("tr-TR")} tıklama</span>
          {r.mobil_key && <span>· mobil görsel var</span>}
        </div>

        {/*
          ⚠ DURUM ANAHTAR OLARAK.
          Metin düğmesi ("Yayında — kapat") ne olduğunu değil ne
          olacağını anlatıyordu; okuması yorucuydu.
        */}
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-chip px-4 py-3">
          <span className="text-[13px] font-semibold">Sitede göster</span>
          <Anahtar acik={r.aktif} onDegis={onDurum} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDuzenle}
            aria-label="Düzenle"
            title="Düzenle"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line"
          >
            <Icon name="edit" size={15} />
          </button>

          <span className="flex-1" />

          <button
            type="button"
            onClick={onYukari}
            disabled={ilk}
            aria-label="Yukarı taşı"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line disabled:opacity-30"
          >
            <span className="-rotate-90"><Icon name="chevronLeft" size={14} /></span>
          </button>
          <button
            type="button"
            onClick={onAsagi}
            disabled={son}
            aria-label="Aşağı taşı"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line disabled:opacity-30"
          >
            <span className="rotate-90"><Icon name="chevronRight" size={14} /></span>
          </button>

          <button
            type="button"
            onClick={onSil}
            aria-label="Sil"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/40 text-red-500"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
