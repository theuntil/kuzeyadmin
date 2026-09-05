"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle, r2Vazgec } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Field, Input, Textarea, Select, Badge,
  Alert, Divider, EmptyState, StatCard,
} from "@/components/ui";
import Icon, { type IconName } from "@/components/ui/Icon";
import PhotoModal from "./PhotoModal";
import SosyalDuzenle, { type Sosyal } from "./SosyalDuzenle";
import SosyalGoster from "./SosyalGoster";

/* ══════════════════════════════════════════════════════════════
   KULLANICI DETAYI

   ┌─ SAYFA SALT OKUNUR ⚠️ ────────────────────────────────────┐
   │ Önce tüm alanlar açık form olarak duruyordu; sayfayı açan  │
   │ kişi yanlışlıkla bir alana yazıp kaydedebiliyordu.         │
   │                                                              │
   │ Artık bilgiler okunur; değiştirmek için sağ üstteki kalem  │
   │ düğmesi bir popup açıyor. Popup'ta HİÇBİR ŞEY DEĞİŞMEDİYSE │
   │ kaydet düğmesi pasif — boşuna istek atılmıyor.             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface UserFull {
  id: string;
  role: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  email_verified_at: string | null;
  bio: string | null;
  title: string | null;
  locale: string;
  is_active: boolean;
  avatar_key: string | null;
  avatar_url: string | null;
  cover_key: string | null;
  city_id: string | null;
  city_name: string | null;
  created_at: string;
  last_seen_at: string | null;
  sayilar: { yorum: number; begeni: number; kaydedilen: number; haber: number; medya: number };
  engelli: boolean;
  /** Sosyal medya kullanıcı adları — tam adres değil */
  social_links: Sosyal | null;
  /** true ise yazarın haberleri onaydan geçmeden yayımlanır */
  dogrudan_yayin: boolean;
}

export interface UserComment {
  id: string; body: string; status: string; created_at: string;
  article_id: string; article_title: string; article_slug: string;
}

/** Rol seçenekleri — ikonlu kare kutular */
const ROLLER: { v: string; l: string; ikon: IconName; not: string }[] = [
  { v: "reader", l: "Okuyucu", ikon: "user",     not: "Yorum yazar, haber kaydeder" },
  { v: "author", l: "Yazar",   ikon: "edit",     not: "Haber yazar, onaya gönderir" },
  { v: "admin",  l: "Yönetici", ikon: "settings", not: "Her şeye erişir" },
];

export default function UserDetail({
  user: ilk, comments: ilkYorumlar, cities, cdnBase, meId,
}: {
  user: UserFull;
  comments: UserComment[];
  cities: { id: string; name: string }[];
  cdnBase: string;
  meId: string;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [u, setU] = useState<UserFull>(ilk);
  const [yorumlar, setYorumlar] = useState(ilkYorumlar);

  const [duzenle, setDuzenle] = useState(false);
  /** Düzenleme penceresindeki sosyal bağlantı taslağı */
  const [sosyalTaslak, setSosyalTaslak] = useState<Sosyal | null>(null);
  const [yayinKaydediyor, setYayinKaydediyor] = useState(false);
  const [taslak, setTaslak] = useState<UserFull>(ilk);
  const [kaydediyor, setKaydediyor] = useState(false);

  const [fotoMod, setFotoMod] = useState<"avatar" | "cover" | null>(null);
  const [fotoKaydediyor, setFotoKaydediyor] = useState(false);

  const [silOnay, setSilOnay] = useState(false);
  /*
   * ⚠ SİLME 10-20 SANİYE SÜRÜYOR.
   *
   * İçerik silme, R2'den dosya silme ve auth kaydı — üç ayrı
   * iş. Bu süre boyunca hiçbir geri bildirim yoktu: yönetici
   * düğmeye basıyor, hiçbir şey olmuyor sanıyor ve tekrar
   * basıyordu.
   */
  const [siliniyor, setSiliniyor] = useState(false);
  const [engelOnay, setEngelOnay] = useState(false);
  const [yorumSil, setYorumSil] = useState<UserComment | null>(null);

  const kendisi = u.id === meId;
  const foto = u.avatar_key ? `${cdn}/${u.avatar_key}` : u.avatar_url;
  const kapak = u.cover_key ? `${cdn}/${u.cover_key}` : null;

  /* Değişen alanları hesapla — hiçbiri değişmediyse istek atma */
  function farklar(): Record<string, string | null> {
    const alanlar: (keyof UserFull)[] = [
      "display_name", "username", "first_name", "last_name",
      "email", "bio", "title", "city_id",
    ];
    const y: Record<string, string | null> = {};
    for (const a of alanlar) {
      const eski = (u[a] ?? "") as string;
      const yeni = (taslak[a] ?? "") as string;
      if (eski !== yeni) y[a] = yeni === "" ? null : yeni;
    }
    return y;
  }

  const degisiklikVar = duzenle && Object.keys(farklar()).length > 0;
  const rolDegisti = duzenle && taslak.role !== u.role;

  /** Yazarın haberleri onaydan geçsin mi */
  async function yayinYetki(dogrudan: boolean) {
    if (u.dogrudan_yayin === dogrudan) return;
    setYayinKaydediyor(true);
    const { error } = await sb.rpc("admin_yazar_yetki", {
      p_user_id: u.id, p_dogrudan: dogrudan,
    });
    setYayinKaydediyor(false);
    if (error) { t.error(error.message); return; }
    setU((p) => ({ ...p, dogrudan_yayin: dogrudan }));
    t.success(dogrudan
      ? "Haberler doğrudan yayınlanacak"
      : "Haberler onaydan geçecek");
  }

  async function kaydet() {
    const y = farklar();
    const rolY = taslak.role !== u.role;
    /* Sosyal bağlantılar da aynı kaydetmeyle gidiyor */
    const sosyalY = sosyalTaslak !== null;

    if (Object.keys(y).length === 0 && !rolY && !sosyalY) {
      // Boşuna fetch atma — düğme zaten pasif ama çift koruma
      setDuzenle(false);
      return;
    }

    setKaydediyor(true);

    if (rolY) {
      const { error } = await sb.rpc("admin_set_role", {
        p_user_id: u.id, p_role: taslak.role,
      });
      if (error) { setKaydediyor(false); t.error(error.message); return; }
      setU((p) => ({ ...p, role: taslak.role }));
    }

    if (Object.keys(y).length > 0) {
      const { data, error } = await sb.rpc("admin_user_update", { p: { id: u.id, ...y } });
      if (error) { setKaydediyor(false); t.error(error.message); return; }
      if (data) setU(data as unknown as UserFull);

      /*
       * Sosyal bağlantılar ayrı bir uçtan gidiyor (temizleme ve
       * doğrulama orada). Ana kaydetme başarılıysa bu da
       * gönderiliyor — kullanıcı için tek işlem.
       */
      if (sosyalTaslak) {
        const { error: sErr } = await sb.rpc("admin_sosyal_guncelle", {
          p: { tur: "kullanici", id: u.id, links: sosyalTaslak },
        });
        if (sErr) { setKaydediyor(false); t.error(sErr.message); return; }
        setU((p) => ({ ...p, social_links: sosyalTaslak }));
        setSosyalTaslak(null);
      }
      setKaydediyor(false);
    } else {
      setKaydediyor(false);
    }

    setDuzenle(false);
    t.success("Kaydedildi");
  }

  /* ---- Fotoğraf ---- */
  async function fotoYukle(blob: Blob) {
    if (!fotoMod) return;
    setFotoKaydediyor(true);
    let key = "";
    try {
      const dosya = new File([blob], `${fotoMod}.jpg`, { type: "image/jpeg" });
      ({ key } = await r2Yukle(dosya, "library", `${fotoMod}-${u.id}.jpg`));
    } catch (e) {
      setFotoKaydediyor(false);
      t.error(e instanceof Error ? e.message : "Yüklenemedi");
      return;
    }

    const alan = fotoMod === "avatar" ? "avatar_key" : "cover_key";
    const { data, error } = await sb.rpc("admin_user_update", {
      p: { id: u.id, [alan]: key },
    });
    setFotoKaydediyor(false);
    if (error) { await r2Vazgec(key); t.error(error.message); return; }
    if (data) setU(data as unknown as UserFull);
    setFotoMod(null);
    t.success("Fotoğraf güncellendi");
  }

  async function fotoKaldir() {
    if (!fotoMod) return;
    setFotoKaydediyor(true);
    const alan = fotoMod === "avatar" ? "avatar_key" : "cover_key";
    const { data, error } = await sb.rpc("admin_user_update", {
      p: { id: u.id, [alan]: "" },
    });
    setFotoKaydediyor(false);
    if (error) { t.error(error.message); return; }
    if (data) setU(data as unknown as UserFull);
    setFotoMod(null);
    t.success("Fotoğraf kaldırıldı");
  }

  async function engelle() {
    const { error } = await sb.rpc("admin_set_active", {
      p_user_id: u.id, p_active: !u.is_active,
    });
    setEngelOnay(false);
    if (error) { t.error(error.message); return; }
    setU((p) => ({ ...p, is_active: !p.is_active, engelli: p.is_active }));
    t.success(u.is_active ? "Hesap engellendi" : "Engel kaldırıldı");
  }

  async function hesabiSil() {
    setSiliniyor(true);
    /*
     * ⚠ ARTIK RPC DOĞRUDAN ÇAĞRILMIYOR.
     *
     * `admin_delete_user` yalnızca içeriği ve profili siliyor;
     * `auth.users` kaydına kasıtlı olarak dokunmuyor. O adım
     * hiçbir yerde yazılmamıştı — kullanıcı silinmiş görünüp
     * aslında silinmiyordu: giriş denemesi yapabiliyor, aynı
     * e-postayla yeniden kayıt olunamıyordu.
     *
     * Bu uç iki aşamayı sırayla yürütüyor ve ikincisi
     * başarısız olursa AÇIKÇA uyarıyor.
     */
    const yanit = await fetch("/api/kullanici-sil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: u.id }),
    }).catch(() => null);

    if (!yanit) {
      setSiliniyor(false);
      setSilOnay(false);
      t.error("Bağlantı kurulamadı");
      return;
    }

    const j = (await yanit.json().catch(() => ({}))) as {
      ozet?: { yorum: number; haber: number; dosya: number };
      dosya_silindi?: number;
      dosya_kalan?: number;
      auth_silindi?: boolean;
      uyari?: string;
      error?: string;
      detail?: string;
    };

    if (!yanit.ok) {
      setSiliniyor(false);
      setSilOnay(false);
      t.error(j.detail ?? j.error ?? "Silinemedi");
      return;
    }

    setSilOnay(false);

    const o = j.ozet;
    const ozetMetin = o
      ? `${o.yorum} yorum, ${o.haber} haber, ${j.dosya_silindi ?? 0} dosya`
      : "içerik";

    if (j.auth_silindi === false) {
      /*
       * Yarım kalan silme sessizce "başarılı" gösterilmiyor —
       * tam da bu davranış mevcut soruna yol açmıştı.
       */
      t.error(`${ozetMetin} silindi ama ${j.uyari ?? "giriş kaydı silinemedi"}`);
    } else {
      t.success(`Hesap tamamen silindi — ${ozetMetin}`);
    }

    window.location.href = "/kullanici";
  }

  async function yorumSilOnayla() {
    if (!yorumSil) return;
    const hedef = yorumSil;
    const { error } = await sb.rpc("delete_article_comment", { p_comment_id: hedef.id });
    setYorumSil(null);
    if (error) { t.error(error.message); return; }
    setYorumlar((p) => p.filter((c) => c.id !== hedef.id));
    t.success("Yorum silindi");
  }

  const rolEtiket = ROLLER.find((r) => r.v === u.role)?.l
    ?? (u.role === "editor" ? "Editör" : u.role);

  return (
    <div className="flex flex-col gap-5">
      {/* ══ Kapak + avatar ══ */}
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setFotoMod("cover")}
          aria-label="Kapak fotoğrafı"
          className="relative block h-32 w-full bg-chip transition-opacity hover:opacity-90 sm:h-40"
        >
          {kapak && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={kapak} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute end-3 top-3 flex h-9 items-center gap-1.5 rounded-[11px] bg-page/80 px-3 text-[12.5px] font-semibold backdrop-blur">
            <Icon name="camera" size={14} /> Kapak
          </span>
        </button>

        <div className="flex flex-wrap items-end gap-4 p-5 pt-0">
          <div className="-mt-10 shrink-0">
            <button
              type="button"
              onClick={() => setFotoMod("avatar")}
              aria-label="Profil fotoğrafı"
              className="relative block"
            >
              {foto ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={foto} alt=""
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-surface" />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-chip text-[26px] font-bold ring-4 ring-surface">
                  {(u.first_name ?? u.display_name ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-1 -end-1 flex h-8 w-8 items-center justify-center rounded-full bg-solid text-on-solid">
                <Icon name="camera" size={14} />
              </span>
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="kb-h2">{u.display_name}</h2>
              {!u.is_active && <Badge tone="danger">Engelli</Badge>}
              {u.email_verified_at && <Badge tone="green">Doğrulanmış</Badge>}
              <Badge tone={u.role === "admin" ? "accent" : "muted"}>{rolEtiket}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {u.email ?? "e-posta yok"}
              {u.username ? ` · @${u.username}` : ""}
              {u.city_name ? ` · ${u.city_name}` : ""}
            </p>
          </div>

          {/* ── Eylemler: düzenle · engelle · sil ── */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => { setTaslak(u); setDuzenle(true); }}
              aria-label="Düzenle"
              title="Düzenle"
              className="kb-lift flex h-9 w-9 items-center justify-center rounded-[11px] bg-chip text-ink2 transition-colors hover:text-ink"
            >
              <Icon name="edit" size={16} />
            </button>
            {!kendisi && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEngelOnay(true)}>
                  <Icon name="warn" size={15} />
                  {u.is_active ? "Engelle" : "Engeli kaldır"}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setSilOnay(true)}>
                  <Icon name="trash" size={15} /> Sil
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* ══ Sayılar ══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Yorum" value={u.sayilar.yorum} />
        <StatCard label="Haber" value={u.sayilar.haber} />
        <StatCard label="Beğeni" value={u.sayilar.begeni} />
        <StatCard label="Kaydedilen" value={u.sayilar.kaydedilen} />
        <StatCard label="Medya" value={u.sayilar.medya} />
      </div>

      {/* ══ Bilgiler — SALT OKUNUR ══ */}
      <Card className="p-5">
        <CardHead
          title="Bilgiler"
          action={
            <Button variant="ghost" size="sm" onClick={() => { setTaslak(u); setDuzenle(true); }}>
              <Icon name="edit" size={15} /> Düzenle
            </Button>
          }
        />
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            ["Ad", u.first_name], ["Soyad", u.last_name],
            ["Kullanıcı adı", u.username ? `@${u.username}` : null],
            ["E-posta", u.email], ["Şehir", u.city_name],
            ["Kayıt", new Date(u.created_at).toLocaleDateString("tr-TR")],
            ["Son görülme", u.last_seen_at
              ? new Date(u.last_seen_at).toLocaleString("tr-TR") : "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex items-baseline gap-3">
              <dt className="w-28 shrink-0 text-[12.5px] text-muted">{k}</dt>
              <dd className="min-w-0 flex-1 truncate text-[13.5px]">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {u.bio && (
          <>
            <Divider className="my-4" />
            <p className="text-[13.5px] leading-relaxed text-ink2">{u.bio}</p>
          </>
        )}
      </Card>

      {/*
        ══ Yayın yetkisi ══

        Yalnızca yazar ve üstü için. Okuyucuya bu yetkiyi
        vermek anlamsız — haber yazamıyor.
      */}
      {["author", "editor", "admin"].includes(u.role) && (
        <Card className="p-5">
          <CardHead
            title="Yayın yetkisi"
            desc="Bu yazarın haberleri onaydan geçsin mi?"
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {([
              [false, "Onaydan geçsin", "Haberler incelemeye düşer, yönetici onaylar.", "clock"],
              [true, "Doğrudan yayınlansın", "Haberler beklemeden yayına girer.", "check"],
            ] as const).map(([deger, ad, aciklama, ikon]) => {
              const secili = u.dogrudan_yayin === deger;
              return (
                <button
                  key={String(deger)}
                  type="button"
                  disabled={yayinKaydediyor}
                  onClick={() => void yayinYetki(deger)}
                  className={`flex items-start gap-3 rounded-[16px] border-2 p-4 text-start transition-colors ${
                    secili
                      ? "border-transparent bg-solid text-on-solid"
                      : "border-line2 hover:border-line"
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    secili ? "bg-white/20" : "bg-chip"
                  }`}>
                    <Icon name={ikon} size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold">{ad}</span>
                    <span className={`mt-0.5 block text-[12px] leading-snug ${
                      secili ? "opacity-85" : "text-muted2"
                    }`}>
                      {aciklama}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/*
        ══ Sosyal bağlantılar ══

        Yazar sayfasında görünüyorlar. Okuyucularda da
        düzenlenebiliyor — rol sonradan yazara çevrilebilir ve
        bilgi hazır olsun.
      */}
      <Card className="p-5">
        <CardHead
          title="Sosyal medya ve web sitesi"
          desc={
            u.username
              ? `Yazar sayfasında görünür: /yazar/${u.username}`
              : "Kullanıcı adı olmadan yazar sayfası açılmaz."
          }
        />
        {/*
          ⚠ BURASI YALNIZCA GÖSTERİYOR.
          Ekran açılır açılmaz düzenleme kutuları çıkıyordu;
          okumak isteyen biri formla karşılaşıyordu. Düzenleme
          "Düzenle" penceresinin içinde.
        */}
        <SosyalGoster
          links={u.social_links}
          onDuzenle={() => setDuzenle(true)}
        />
      </Card>

      {/* ══ Yorumlar ══ */}
      <Card className="p-5">
        <CardHead title="Yorumları" desc={`Son ${yorumlar.length} yorum. Silme geri alınamaz.`} />
        {yorumlar.length === 0 ? (
          <EmptyState title="Yorum yok" />
        ) : (
          <div className="flex flex-col">
            {yorumlar.map((c, i) => (
              <div key={c.id}
                className={`flex items-start gap-3 py-3 ${i > 0 ? "border-t border-line2" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-muted">
                      {c.article_title}
                    </span>
                    <Badge tone={c.status === "approved" ? "green" : "orange"}>
                      {c.status === "approved" ? "Onaylı" : c.status}
                    </Badge>
                    <span className="kb-num text-[11.5px] text-muted2">
                      {new Date(c.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed">{c.body}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setYorumSil(c)}>
                  <Icon name="trash" size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ══════════ DÜZENLEME POPUP'I ══════════ */}
      <Modal
        open={duzenle}
        onClose={() => setDuzenle(false)}
        title="Kullanıcıyı düzenle"
        wide
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={kaydet}
              loading={kaydediyor}
              /* Değişiklik yoksa pasif — boşuna istek atılmasın */
              disabled={!degisiklikVar && !rolDegisti}
            >
              Kaydet
            </Button>
            <Button variant="ghost" onClick={() => setDuzenle(false)} disabled={kaydediyor}>
              Vazgeç
            </Button>
            {!degisiklikVar && !rolDegisti && (
              <span className="text-[12.5px] text-muted2">Değişiklik yok</span>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Görünen ad">
              <Input value={taslak.display_name}
                onChange={(e) => setTaslak({ ...taslak, display_name: e.target.value })} />
            </Field>
            <Field label="Kullanıcı adı">
              <Input value={taslak.username ?? ""}
                onChange={(e) => setTaslak({ ...taslak, username: e.target.value })} />
            </Field>
            <Field label="Ad">
              <Input value={taslak.first_name ?? ""}
                onChange={(e) => setTaslak({ ...taslak, first_name: e.target.value })} />
            </Field>
            <Field label="Soyad">
              <Input value={taslak.last_name ?? ""}
                onChange={(e) => setTaslak({ ...taslak, last_name: e.target.value })} />
            </Field>
            <Field label="E-posta">
              <Input type="email" value={taslak.email ?? ""}
                onChange={(e) => setTaslak({ ...taslak, email: e.target.value })} />
            </Field>
            <Field label="Şehir">
              <Select value={taslak.city_id ?? ""}
                onChange={(e) => setTaslak({ ...taslak, city_id: e.target.value || null })}>
                <option value="">— yok —</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          </div>

          {/*
            Unvan ve biyografi.

            ⚠ HER ROL İÇİN. Okuyucu bugün doldurur, yarın yazar
            yapılınca hazır olur. Yazar sayfasında ikisi de
            görünüyor.
          */}
          <Field label="Unvan" hint="yazar sayfasında adın altında görünür">
            <Input value={taslak.title ?? ""}
              onChange={(e) => setTaslak({ ...taslak, title: e.target.value })}
              placeholder="Muhabir · Editör · Köşe yazarı" />
          </Field>

          <Field
            label="Biyografi"
            hint={`Yazar sayfasında görünür · ${(taslak.bio ?? "").length}/2000`}
          >
            <Textarea
              value={taslak.bio ?? ""}
              className="min-h-[120px]"
              maxLength={2000}
              onChange={(e) => setTaslak({ ...taslak, bio: e.target.value })}
              placeholder="Kısa tanıtım yazısı…"
            />
          </Field>

          <Divider />

          {/* Sosyal bağlantılar — ana kaydet ile birlikte gidiyor */}
          <SosyalDuzenle
            tur="kullanici"
            id={u.id}
            mevcut={u.social_links}
            ayriKaydet={false}
            onDegisti={setSosyalTaslak}
          />

          <Divider />

          {/* ── Rol: ikonlu kare kutular ── */}
          <div>
            <span className="mb-2.5 block text-[13px] font-semibold text-ink2">Rol</span>
            {kendisi ? (
              <Alert tone="muted">
                Kendi rolünü değiştiremezsin — panele erişimin kaybolabilir.
              </Alert>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-3">
                {ROLLER.map((r) => {
                  const secili = taslak.role === r.v;
                  return (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setTaslak({ ...taslak, role: r.v })}
                      aria-pressed={secili}
                      className={`kb-lift flex flex-col items-start gap-2 rounded-[16px] p-4 text-start transition-colors ${
                        secili
                          ? "bg-solid text-on-solid"
                          : "bg-chip text-ink2 hover:text-ink"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between">
                        <Icon name={r.ikon} size={20} />
                        {secili && <Icon name="check" size={16} />}
                      </span>
                      <span className="text-[14px] font-semibold">{r.l}</span>
                      <span className={`text-[12px] leading-snug ${secili ? "opacity-75" : "text-muted2"}`}>
                        {r.not}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {u.role === "editor" && (
              <p className="mt-2 text-[12px] text-muted2">
                Bu kullanıcı <strong>editör</strong>. Yukarıdan başka bir rol
                seçersen editörlük kalkar.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* ══════════ FOTOĞRAF POPUP'I ══════════ */}
      <PhotoModal
        open={fotoMod !== null}
        onClose={() => setFotoMod(null)}
        baslik={fotoMod === "cover" ? "Kapak fotoğrafı" : "Profil fotoğrafı"}
        oran={fotoMod === "cover" ? "kapak" : "kare"}
        mevcut={fotoMod === "cover" ? kapak : foto}
        onSecildi={fotoYukle}
        onKaldir={fotoKaldir}
        kaydediyor={fotoKaydediyor}
      />

      <ConfirmDialog
        open={engelOnay} onClose={() => setEngelOnay(false)}
        title={u.is_active ? "Hesap engellensin mi?" : "Engel kaldırılsın mı?"}
        description={u.is_active
          ? "Kullanıcı giriş yapamaz, yorum yazamaz. İçeriği silinmez."
          : "Kullanıcı tekrar giriş yapabilecek."}
        confirmLabel={u.is_active ? "Engelle" : "Engeli kaldır"}
        danger={u.is_active}
        onConfirm={engelle}
      />

      <ConfirmDialog
        open={silOnay} onClose={() => setSilOnay(false)}
        title="Hesap tamamen silinsin mi?"
        description={
          `GERİ ALINAMAZ. Silinecekler: ${u.sayilar.yorum} yorum, ` +
          `${u.sayilar.haber} haber ve medyası, ${u.sayilar.begeni} beğeni, ` +
          `${u.sayilar.kaydedilen} kayıt, ${u.sayilar.medya} kitaplık dosyası, ` +
          "profil ve kapak fotoğrafı. Dosyalar R2'den anında silinir. " +
          "Bu işlem 10-20 saniye sürebilir."
        }
        confirmLabel="Kalıcı olarak sil"
        onConfirm={hesabiSil}
        loading={siliniyor}
      />

      <ConfirmDialog
        open={Boolean(yorumSil)} onClose={() => setYorumSil(null)}
        title="Yorum silinsin mi?"
        description={yorumSil?.body.slice(0, 140)}
        confirmLabel="Sil"
        onConfirm={yorumSilOnayla}
      />
    </div>
  );
}
