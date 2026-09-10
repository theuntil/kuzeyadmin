"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import Icon from "@/components/ui/Icon";
import { Card, CardHead, Divider } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import YazarHaberleri from "./YazarHaberleri";
import DegisiklikKuyrugu from "./DegisiklikKuyrugu";
import { r2Yukle } from "@/lib/upload";
import PhotoModal from "./PhotoModal";
import { Anahtar } from "@/components/ui/Anahtar";
import SosyalAlanlar from "./SosyalAlanlar";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   YAZAR DETAYI

   Kullanıcı detayından ayrı bir sayfa: yazara özgü olan her şey
   burada toplanıyor — künye bilgileri, ana sayfada görünürlük,
   yayın sayıları ve haber listesi.

   ⚠ VERİ MEVCUT FONKSİYONLARDAN.
   Yeni bir SQL yazılmadı; `admin_user_full`, `admin_user_update`,
   `admin_yazar_haberleri` ve `admin_yazar_gorunurluk` zaten
   vardı. Aynı işi yapan ikinci bir fonksiyon yazmak, ileride
   ikisini birden güncellemeyi unutma riski demekti.
   ══════════════════════════════════════════════════════════════ */

interface Yazar {
  id: string;
  display_name: string | null;
  username: string | null;
  title: string | null;
  bio: string | null;
  role: string;
  avatar_key: string | null;
  cover_key: string | null;
  social_links: Record<string, string> | null;
  dogrudan_yayin: boolean;
  is_active: boolean;
  yazarlar_sayfasinda: boolean;
  created_at: string;
}

interface Haber {
  durum: string;
  okuma: number;
  degisiklik_bekliyor: boolean;
}

export default function YazarDetay({
  id, cdnBase,
}: { id: string; cdnBase: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [y, setY] = useState<Yazar | null>(null);
  const [ozet, setOzet] = useState({
    toplam: 0, yayinda: 0, bekleyen: 0, okuma: 0,
  });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  /*
   * ⚠ KULLANICI SAYFASIYLA AYNI MEKANİZMA.
   * Ayrı bir yükleme akışı yazmak yerine `PhotoModal` yeniden
   * kullanılıyor; kırpma, oran ve kaldırma davranışı iki
   * sayfada birebir aynı kalıyor.
   */
  const [duzenle, setDuzenle] = useState(false);
  const [fotoMod, setFotoMod] = useState<"avatar" | "cover" | null>(null);
  const [fotoKaydediyor, setFotoKaydediyor] = useState(false);

  /* Düzenlenebilir alanlar — ayrı tutuluyor ki "kaydet" anlamlı olsun */
  const [ad, setAd] = useState("");
  const [unvan, setUnvan] = useState("");
  const [ozgecmis, setOzgecmis] = useState("");

  const yukle = useCallback(async () => {
    setYukleniyor(true);

    const [u, h] = await Promise.all([
      sb.rpc("admin_user_full", { p_id: id }),
      sb.rpc("admin_yazar_haberleri", { p_id: id, p_limit: 200 }),
    ]);
    setYukleniyor(false);

    if (u.error) { t.error("Yazar okunamadı: " + u.error.message); return; }

    const veri = (u.data ?? null) as Yazar | null;
    if (!veri) return;

    setY(veri);
    setAd(veri.display_name ?? "");
    setUnvan(veri.title ?? "");
    setOzgecmis(veri.bio ?? "");

    /*
     * Özet sayılar haber listesinden türetiliyor; ayrı bir
     * sorgu açmak gereksiz bir gidiş-dönüş olurdu.
     */
    const haberler = (h.data ?? []) as Haber[];
    setOzet({
      toplam: haberler.length,
      yayinda: haberler.filter((x) => x.durum === "published").length,
      bekleyen: haberler.filter(
        (x) => x.durum === "pending_review" || x.degisiklik_bekliyor,
      ).length,
      okuma: haberler.reduce((n, x) => n + Number(x.okuma ?? 0), 0),
    });
  }, [sb, t, id]);

  useEffect(() => { void yukle(); }, [yukle]);

  /**
   * Yayın yetkisi — yazarın haberleri onaydan geçsin mi.
   *
   * ⚠ KULLANICI SAYFASINDA VARDI, BURADA YOKTU.
   * Yazara özgü en önemli ayar; yazar sayfasında bulunmaması
   * yöneticiyi kullanıcı sayfasına gitmeye zorluyordu.
   */
  async function yayinYetki(dogrudan: boolean) {
    if (!y || y.dogrudan_yayin === dogrudan) return;

    /* İyimser: anahtar hemen dönüyor, hata olursa geri alınıyor */
    setY({ ...y, dogrudan_yayin: dogrudan });

    const { error } = await sb.rpc("admin_yazar_yetki", {
      p_user_id: y.id, p_dogrudan: dogrudan,
    });

    if (error) {
      setY({ ...y, dogrudan_yayin: !dogrudan });
      t.error(error.message);
      return;
    }
    t.success(dogrudan
      ? "Haberler doğrudan yayınlanacak"
      : "Haberler onaydan geçecek");
  }

  async function fotoYukle(blob: Blob) {
    if (!y || !fotoMod) return;
    setFotoKaydediyor(true);
    try {
      const dosya = new File([blob], `${fotoMod}.jpg`, { type: "image/jpeg" });
      const { key } = await r2Yukle(dosya, "library", `${fotoMod}-${y.id}.jpg`);

      const alan = fotoMod === "avatar" ? "avatar_key" : "cover_key";
      const { error } = await sb.rpc("admin_user_update", {
        p: { id: y.id, [alan]: key },
      });
      if (error) throw new Error(error.message);

      setFotoMod(null);
      await yukle();
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setFotoKaydediyor(false);
    }
  }

  async function fotoKaldir() {
    if (!y || !fotoMod) return;
    setFotoKaydediyor(true);

    const alan = fotoMod === "avatar" ? "avatar_key" : "cover_key";
    const { error } = await sb.rpc("admin_user_update", {
      p: { id: y.id, [alan]: null },
    });
    setFotoKaydediyor(false);

    if (error) { t.error(error.message); return; }
    setFotoMod(null);
    await yukle();
  }

  async function kaydet() {
    if (!y || kaydediliyor) return;
    setKaydediliyor(true);

    const { error } = await sb.rpc("admin_user_update", {
      p: {
        id: y.id,
        display_name: ad.trim() || null,
        title: unvan.trim() || null,
        bio: ozgecmis.trim() || null,
      },
    });
    setKaydediliyor(false);

    if (error) { t.error(error.message); return; }
    t.success("Kaydedildi");
    await yukle();
  }

  async function gorunurluk(yeni: boolean) {
    if (!y) return;

    /*
     * ⚠ İYİMSER GÜNCELLEME.
     * Anahtar tıklamada dönüyor; sunucu reddederse eski değere
     * dönülüyor. Beklemek düğmeyi tepkisiz gösteriyordu.
     */
    setY({ ...y, yazarlar_sayfasinda: yeni });

    const { error } = await sb.rpc("admin_yazar_gorunurluk", {
      p_user_id: y.id, p_gorunur: yeni,
    });

    if (error) {
      setY({ ...y, yazarlar_sayfasinda: !yeni });
      t.error(error.message);
    }
  }

  if (yukleniyor) {
    return (
      <div className="grid gap-4">
        <div className="h-32 animate-pulse rounded-2xl bg-surface2" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface2" />
      </div>
    );
  }

  if (!y) {
    return (
      <p className="py-12 text-center text-[14px] text-muted2">
        Yazar bulunamadı.
      </p>
    );
  }

  const avatar = y.avatar_key ? `${cdn}/${y.avatar_key}` : null;
  const kapak = y.cover_key ? `${cdn}/${y.cover_key}` : null;
  const gorunenAd = y.display_name?.trim() || y.username || "Yazar";

  return (
    <div className="grid gap-5">
      {/* ---- künye ---- */}
      <Card className="overflow-hidden p-0">
        {/*
          ⚠ KAPAK DA DÜZENLENEBİLİYOR.
          Kullanıcı sayfasında vardı, yazar sayfasında yoktu.
          Aynı bileşen, aynı davranış.
        */}
        <button
          type="button"
          onClick={() => setFotoMod("cover")}
          aria-label="Kapak fotoğrafı"
          className="relative block h-28 w-full bg-chip transition-opacity hover:opacity-90 sm:h-36"
        >
          {kapak && (
            <img src={kapak} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute end-3 top-3 flex h-9 items-center gap-1.5 rounded-[11px] bg-page/80 px-3 text-[12.5px] font-semibold backdrop-blur">
            <Icon name="camera" size={14} /> Kapak
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-4 p-5">
          <button
            type="button"
            onClick={() => setFotoMod("avatar")}
            aria-label="Profil fotoğrafı"
            className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-chip text-[24px] font-extrabold text-muted2"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              gorunenAd.charAt(0).toLocaleUpperCase("tr")
            )}
            <span className="absolute inset-x-0 bottom-0 bg-page/75 py-0.5 text-[9.5px] font-bold backdrop-blur">
              Değiştir
            </span>
          </button>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[19px] font-extrabold">
              {gorunenAd}
            </span>
            <span className="block text-[13px] text-muted2">
              {y.title || "Unvan girilmemiş"}
              {y.username && ` · @${y.username}`}
            </span>
            <span className="mt-1 block text-[12px] text-muted2">
              {y.yazarlar_sayfasinda
                ? "Ana sayfada görünüyor"
                : "Ana sayfada gizli"}
              {" · "}
              {y.dogrudan_yayin ? "Doğrudan yayınlıyor" : "Onaydan geçiyor"}
            </span>
          </span>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-bold ${
              y.is_active
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-chip text-muted2"
            }`}
          >
            {y.is_active ? "Aktif" : "Pasif"}
          </span>

          <button
            type="button"
            onClick={() => setDuzenle(true)}
            aria-label="Düzenle"
            title="Düzenle"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line"
          >
            <Icon name="edit" size={15} />
          </button>
        </div>
      </Card>

      {/* ---- sayılar ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kutu baslik="Toplam haber" deger={ozet.toplam} />
        <Kutu baslik="Yayında" deger={ozet.yayinda} />
        <Kutu baslik="Onay bekleyen" deger={ozet.bekleyen} vurgu={ozet.bekleyen > 0} />
        <Kutu baslik="Toplam okunma" deger={ozet.okuma} />
      </div>

      {/*
        ⚠ AYARLAR PENCEREDE.
        Görünürlük, künye ve sosyal medya sayfada üç ayrı kart
        olarak duruyordu; sayfa açılır açılmaz form karşılıyordu.
        Kullanıcı sayfasındaki desen: okumak isteyene bilgi,
        değiştirmek isteyene "Düzenle".
      */}

      {/*
        Bekleyen değişiklikler — yalnızca varsa.
        Boş bir kart her yazarda göze çarpardı.
      */}
      {ozet.bekleyen > 0 && (
        <Card className="p-5">
          <CardHead
            title="Onay bekleyen değişiklikler"
            desc="Bu yazarın gönderdiği, yayına henüz geçmemiş düzenlemeler."
          />
          <DegisiklikKuyrugu yazarId={y.id} />
        </Card>
      )}

      {/* ---- haberleri ---- */}
      <Card className="p-5">
        <CardHead
          title="Haberleri"
          desc="Düzenlemek için kalem, kaldırmak için çöp kutusu."
        />
        <YazarHaberleri userId={y.id} cdnBase={cdnBase} />
      </Card>

      {/*
        ⚠ TAM YÖNETİM İÇİN BAĞLANTI.
        Rol değiştirme, hesap engelleme ve silme gibi işlemler
        kullanıcı sayfasında. İkisini birden yazar sayfasına
        kopyalamak aynı işi iki yerde bakım demekti; buradan
        tek tıkla gidiliyor.
      */}
      <Link
        href={`/kullanici/${y.id}`}
        className="flex items-center justify-between rounded-2xl border border-line p-4 transition-colors hover:border-ink/25"
      >
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">
            Hesap ayarları
          </span>
          <span className="block text-[12px] text-muted2">
            Rol, e-posta, engelleme, yorumlar ve hesap silme
          </span>
        </span>
        <Icon name="chevronRight" size={16} />
      </Link>

      {/*
        ⚠ TÜM AYARLAR TEK PENCEREDE.
        Künye, görünürlük, yayın yetkisi ve sosyal medya —
        hepsi burada. Sayfa okunur kalıyor, değiştirmek isteyen
        tek yere bakıyor.
      */}
      <Modal
        open={duzenle}
        onClose={() => setDuzenle(false)}
        title="Yazarı düzenle"
      >
        <div className="grid gap-5">
          <div>
            <div className="mb-2 text-[12.5px] font-bold">Künye</div>

            <label className="mb-1.5 block text-[12.5px] font-semibold">
              Görünen ad
            </label>
            <input
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              className="mb-3 w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
            />

            <label className="mb-1.5 block text-[12.5px] font-semibold">
              Unvan
            </label>
            <input
              value={unvan}
              onChange={(e) => setUnvan(e.target.value)}
              placeholder="Muhabir, Köşe yazarı…"
              className="mb-3 w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
            />

            <label className="mb-1.5 block text-[12.5px] font-semibold">
              Özgeçmiş
            </label>
            <textarea
              value={ozgecmis}
              onChange={(e) => setOzgecmis(e.target.value)}
              rows={4}
              placeholder="Yazar sayfasında görünür."
              className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
            />

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void kaydet()}
                disabled={kaydediliyor}
                className="rounded-lg bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-40"
              >
                {kaydediliyor ? "Kaydediliyor…" : "Künyeyi kaydet"}
              </button>
            </div>
          </div>

          <Divider />

          <div>
            <div className="mb-3 text-[12.5px] font-bold">Görünürlük</div>

            <div className="mb-2 flex items-center justify-between rounded-xl bg-chip px-3.5 py-3">
              <span className="min-w-0 pe-3">
                <span className="block text-[13px] font-semibold">
                  Ana sayfada göster
                </span>
                <span className="block text-[11.5px] text-muted2">
                  &quot;Yazarlarımız&quot; bölümünde listelenir
                </span>
              </span>
              <Anahtar
                acik={y.yazarlar_sayfasinda}
                onDegis={(v) => void gorunurluk(v)}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-chip px-3.5 py-3">
              <span className="min-w-0 pe-3">
                <span className="block text-[13px] font-semibold">
                  Doğrudan yayınlayabilsin
                </span>
                <span className="block text-[11.5px] text-muted2">
                  Kapalıyken haberleri onaydan geçer
                </span>
              </span>
              <Anahtar
                acik={y.dogrudan_yayin}
                onDegis={(v) => void yayinYetki(v)}
              />
            </div>
          </div>

          <Divider />

          <div>
            <div className="mb-3 text-[12.5px] font-bold">
              Sosyal medya ve web sitesi
            </div>
            <SosyalAlanlar
              links={y.social_links}
              onKaydet={async (yeni) => {
                const { error } = await sb.rpc("admin_user_update", {
                  p: { id: y.id, social_links: yeni },
                });
                if (error) { t.error(error.message); return false; }
                t.success("Kaydedildi");
                await yukle();
                return true;
              }}
            />
          </div>
        </div>
      </Modal>

      <PhotoModal
        open={fotoMod !== null}
        onClose={() => setFotoMod(null)}
        baslik={fotoMod === "cover" ? "Kapak fotoğrafı" : "Profil fotoğrafı"}
        oran={fotoMod === "cover" ? "kapak" : "kare"}
        mevcut={fotoMod === "cover" ? kapak : avatar}
        onSecildi={fotoYukle}
        onKaldir={fotoKaldir}
        kaydediyor={fotoKaydediyor}
      />
    </div>
  );
}

function Kutu({
  baslik, deger, vurgu = false,
}: { baslik: string; deger: number; vurgu?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] text-muted2">{baslik}</div>
      <div
        className={`kb-num mt-1 text-[22px] font-extrabold ${
          vurgu ? "text-amber-500" : ""
        }`}
      >
        {deger.toLocaleString("tr-TR")}
      </div>
    </Card>
  );
}
