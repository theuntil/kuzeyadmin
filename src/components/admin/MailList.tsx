"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { Button, Input, EmptyState, Skeleton, Badge } from "@/components/ui";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   MAİL LİSTESİ

   ┌─ ARKA PLANDA YENİLEME ⚠️ ─────────────────────────────────┐
   │ Her 5 saniyede bir sessizce yeniden çekiyor. "Yükleniyor"  │
   │ göstermiyor — liste yerinde güncelleniyor, kullanıcı       │
   │ okurken ekran zıplamıyor.                                   │
   │                                                              │
   │ Sekme arka plandayken durur (`visibilitychange`): açık      │
   │ bırakılan bir panel gece boyu boşuna sorgu atmasın.         │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export type Kutu = "inbox" | "outbox" | "starred";

export interface Satir {
  id: string;
  box: "inbox" | "outbox";
  status: string;
  subject: string | null;
  preview: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  ek_sayisi: number;
  error: string | null;
  tarih: string;
}

const YENILEME_MS = 5000;

function tarihYaz(s: string): string {
  const d = new Date(s);
  const b = new Date();
  const ayniGun = d.toDateString() === b.toDateString();
  return ayniGun
    ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function MailList({
  kutu, ilk,
}: {
  kutu: Kutu;
  ilk: Satir[];
}) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [satirlar, setSatirlar] = useState<Satir[]>(ilk);
  const [arama, setArama] = useState("");
  const [ilkYukleme, setIlkYukleme] = useState(false);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [silOnay, setSilOnay] = useState(false);
  const [senkronHata, setSenkronHata] = useState<string | null>(null);


  /* Arama metni her tuşta sorgu atmasın diye referansta tutulur */
  const aramaRef = useRef(arama);
  aramaRef.current = arama;

  /**
   * IMAP senkronu.
   *
   * Liste çekmeden ÖNCE çalışıyor; yeni mail aynı turda
   * görünsün. Kiralama alamazsa (başka sekme senkron yapıyor)
   * sunucu tarafında sessizce atlanıyor.
   */
  const senkron = useCallback(async (elle = false) => {
    if (kutu === "outbox") return;   // giden kutusu IMAP'tan gelmiyor
    try {
      const r = await fetch(`/api/mail/sync${elle ? "?elle=1" : ""}`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string; kapali?: boolean; atlandi?: boolean;
        yeni?: number; kutuda?: number; bulunan?: number; klasor?: string;
        kopya?: number; hatali?: number;
        ayrinti?: { uid?: string; konu?: string; hata?: string }[];
      };
      if (!r.ok) {
        setSenkronHata(j.error ?? "IMAP senkronu başarısız");
      } else {
        setSenkronHata(null);
        // Atlanan turlar durumu ezmesin: son gerçek sonuç kalsın
        if (!j.atlandi) {
        }
      }
    } catch {
      // Ağ hatası geçici olabilir; listeyi yine de gösteriyoruz
    }
  }, [kutu]);

  const cek = useCallback(async (sessiz: boolean) => {
    if (!sessiz) setIlkYukleme(true);
    await senkron();

    let q = sb.from("admin_mail_box").select("*");
    if (kutu === "inbox")        q = q.eq("box", "inbox").eq("is_archived", false);
    else if (kutu === "outbox")  q = q.eq("box", "outbox");
    else                         q = q.eq("is_starred", true);

    const a = aramaRef.current.trim();
    if (a) {
      const p = `%${a}%`;
      q = q.or(
        `subject.ilike.${p},from_email.ilike.${p},from_name.ilike.${p},preview.ilike.${p}`,
      );
    }

    const { data, error } = await q.order("tarih", { ascending: false }).limit(50);
    if (!sessiz) setIlkYukleme(false);
    if (error) {
      if (!sessiz) t.error("Liste okunamadı: " + error.message);
      return;
    }
    setSatirlar((data ?? []) as unknown as Satir[]);
  }, [sb, kutu, t, senkron]);

  // Kutu ya da arama değişince hemen çek
  useEffect(() => {
    const z = setTimeout(() => void cek(false), arama ? 300 : 0);
    return () => clearTimeout(z);
  }, [cek, arama]);

  // Arka planda sessiz yenileme
  useEffect(() => {
    let acik = !document.hidden;
    const gorunurluk = () => { acik = !document.hidden; };
    document.addEventListener("visibilitychange", gorunurluk);

    const z = setInterval(() => { if (acik) void cek(true); }, YENILEME_MS);
    return () => {
      clearInterval(z);
      document.removeEventListener("visibilitychange", gorunurluk);
    };
  }, [cek]);

  async function yildiz(id: string, deger: boolean) {
    // İyimser güncelleme: tıklama anında değişsin
    setSatirlar((p) => p.map((s) => (s.id === id ? { ...s, is_starred: deger } : s)));
    const { error } = await sb.rpc("admin_mail_flag", {
      p_ids: [id], p_alan: "is_starred", p_deger: deger,
    });
    if (error) {
      setSatirlar((p) => p.map((s) => (s.id === id ? { ...s, is_starred: !deger } : s)));
      t.error(error.message);
    }
  }

  async function isaretle(alan: "is_read" | "is_archived", deger: boolean) {
    const ids = Array.from(secili);
    if (!ids.length) return;
    const { error } = await sb.rpc("admin_mail_flag", {
      p_ids: ids, p_alan: alan, p_deger: deger,
    });
    if (error) { t.error(error.message); return; }
    setSecili(new Set());
    await cek(true);
  }

  async function sil() {
    const ids = Array.from(secili);
    /*
     * ⚠ İYİMSER SİLME.
     * Satırlar EKRANDAN HEMEN kalkıyor. Sunucu yanıtı ve IMAP
     * silmesi saniyeler sürebiliyor; o süre boyunca kullanıcı
     * silinmiş maile bakmaya devam ediyordu ve "silinmedi"
     * sanıyordu.
     *
     * Hata olursa liste geri yükleniyor.
     */
    const yedek = satirlar;
    setSatirlar((p) => p.filter((s) => !ids.includes(s.id)));
    setSilOnay(false);
    setSecili(new Set());

    const { data, error } = await sb.rpc("admin_mail_delete", { p_ids: ids });
    if (error) {
      setSatirlar(yedek);   // geri al
      t.error(error.message);
      return;
    }

    /*
     * SUNUCUDAN DA SİL. Yoksa mail bir sonraki senkronda geri
     * gelir. RPC silinen kayıtların IMAP UID'lerini döndürüyor.
     */
    const o = data as { silinen: number; imap: { uid: number; folder: string }[] } | null;
    if (o?.imap?.length) {
      const r = await fetch("/api/mail/imap-sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imap: o.imap }),
      });
      if (!r.ok) {
        t.error("Panelden silindi ama sunucudan silinemedi — geri gelebilir");
      } else {
        t.success(`${ids.length} mail silindi`);
      }
    } else {
      t.success(`${ids.length} mail silindi`);
    }
    await cek(true);
    setSecili(new Set());
    await cek(true);
  }

  const hepsi = satirlar.length > 0 && secili.size === satirlar.length;

  return (
    <div className="flex flex-col gap-4">
      {senkronHata && (
        <div className="rounded-[16px] bg-orange-soft px-4 py-3 text-[13px] text-orange-ink">
          Gelen kutusu güncellenemedi: {senkronHata}
          {" · "}<Link href="/mail?ayar=1" className="underline">Ayarlar</Link>
        </div>
      )}

      {/* ── Arama ── */}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-muted2">
          <Icon name="search" size={16} />
        </span>
        <Input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Konu, adres veya içerikte ara"
          className="ps-11"
        />
      </div>

      {/* ── Toplu işlem ── */}
      {secili.size > 0 && (
        <div className="kb-fade flex flex-wrap items-center gap-2">
          <span className="kb-num text-[13px] font-semibold">{secili.size} seçili</span>
          <Button variant="outline" size="sm" onClick={() => isaretle("is_read", true)}>
            Okundu
          </Button>
          <Button variant="outline" size="sm" onClick={() => isaretle("is_archived", true)}>
            Arşivle
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSilOnay(true)}>
            <Icon name="trash" size={15} />
          </Button>
        </div>
      )}

      {ilkYukleme ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : satirlar.length === 0 ? (
        <EmptyState
          title={arama ? "Sonuç yok" : "Bu kutu boş"}
          description={arama ? "Farklı bir arama dene." : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Seçim başlığı */}
          <div className="flex items-center gap-3 px-1">
            <button
              type="button"
              onClick={() =>
                setSecili(hepsi ? new Set() : new Set(satirlar.map((s) => s.id)))
              }
              aria-pressed={hepsi}
              aria-label="Hepsini seç"
              className="-m-2 flex h-10 w-10 items-center justify-center rounded-[14px] transition-colors hover:bg-line2"
            >
              <span
                aria-hidden
                className={`flex h-[21px] w-[21px] items-center justify-center rounded-[8px] border-2 transition-colors ${
                  hepsi ? "border-solid bg-solid text-on-solid" : "border-line2"
                }`}
              >
                {hepsi && <Icon name="check" size={13} />}
              </span>
            </button>
            <span className="kb-num text-[13px] text-muted">{satirlar.length} posta</span>
          </div>

          {/*
            KART GÖRÜNÜMÜ.
            Tek bir tablo satırı yerine her mail kendi kartında:
            mobilde satırlar birbirine giriyordu ve okunmamış
            mailin vurgusu kayboluyordu.
          */}
          {satirlar.map((s) => {
            const kisi = s.box === "inbox"
              ? (s.from_name || s.from_email || "(gönderen yok)")
              : (s.to_email || "(alıcı yok)");
            const secildi = secili.has(s.id);
            return (
              <article
                key={s.id}
                /*
                  ⚠ `kb-lift` YOK.
                  O sınıf hover'da kartı ölçekliyordu; liste
                  üzerinde gezerken satırlar büyüyüp küçülüyor,
                  tıklamak istediğin kart kayıyordu.
                  Yalnızca zemin rengi değişiyor.
                */
                className={`flex items-start gap-3 rounded-[22px] p-4 transition-colors duration-150 ${
                  secildi ? "bg-chip" : "bg-surface hover:bg-chip"
                }`}
              >
                {/*
                  ⚠ KUTU KENDİ ETİKETİNİN İÇİNDE.
                  Önce çıplak `<input>` vardı ve kenarına gelen
                  tıklama alttaki bağlantıya düşüyordu — mail
                  seçmek isterken mail açılıyordu.

                  `<label>` vuruş alanını büyütüyor,
                  `stopPropagation` da tıklamanın bağlantıya
                  sızmasını kesiyor.
                */}
                {/*
                  ⚠ VURUŞ ALANI KUTUDAN BÜYÜK.
                  19px'lik bir kutuya parmakla isabet etmek zor;
                  ıskalayan tıklama alttaki bağlantıya düşüyor ve
                  mail açılıyordu.

                  Kutu 40×40'lık bir düğmenin içinde. `onClick`
                  düğmede: kutuya değil, çevresine basmak da
                  seçiyor. `stopPropagation` tıklamanın bağlantıya
                  sızmasını kesiyor.
                */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSecili((p) => {
                      const y = new Set(p);
                      if (y.has(s.id)) y.delete(s.id); else y.add(s.id);
                      return y;
                    });
                  }}
                  aria-pressed={secildi}
                  aria-label={`${kisi} seç`}
                  className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-colors hover:bg-line2"
                >
                  <span
                    aria-hidden
                    className={`flex h-[21px] w-[21px] items-center justify-center rounded-[8px] border-2 transition-colors ${
                      secildi
                        ? "border-solid bg-solid text-on-solid"
                        : "border-line2 bg-transparent"
                    }`}
                  >
                    {secildi && <Icon name="check" size={13} />}
                  </span>
                </button>

                {/* Okunmamışı soldaki nokta işaretliyor — kalın yazı
                    tek başına mobilde fark edilmiyordu */}
                {!s.is_read && s.box === "inbox" && (
                  <span aria-label="Okunmadı"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-solid" />
                )}

                <Link href={`/mail/${s.id}`} className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`min-w-0 flex-1 truncate text-[13.5px] ${
                      s.is_read ? "text-muted" : "font-semibold text-ink"
                    }`}>
                      {kisi}
                    </span>
                    <span className="kb-num shrink-0 text-[12px] text-muted2">
                      {tarihYaz(s.tarih)}
                    </span>
                  </span>

                  <span className={`mt-1 block truncate text-[15px] ${
                    s.is_read ? "text-ink2" : "font-semibold text-ink"
                  }`}>
                    {s.subject || "(konu yok)"}
                  </span>

                  {s.preview && (
                    <span className="mt-1 line-clamp-2 block text-[12.5px] leading-relaxed text-muted2">
                      {s.preview}
                    </span>
                  )}

                  {(s.has_attachments || s.status === "failed" || s.status === "sending") && (
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      {s.has_attachments && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-chip px-2 py-0.5 text-[11.5px] text-muted">
                          <Icon name="file" size={12} /> {s.ek_sayisi} ek
                        </span>
                      )}
                      {s.status === "failed" && <Badge tone="danger">Gönderilemedi</Badge>}
                      {s.status === "sending" && <Badge tone="orange">Kuyrukta</Badge>}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => yildiz(s.id, !s.is_starred)}
                  aria-label={s.is_starred ? "Kaydedilenlerden çıkar" : "Kaydet"}
                  title={s.is_starred ? "Kaydedilenlerden çıkar" : "Kaydet"}
                  className={`kb-lift flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                    s.is_starred
                      ? "bg-solid text-on-solid"
                      : "bg-chip text-muted2 hover:text-ink"
                  }`}
                >
                  <Icon name="star" size={16} dolu={s.is_starred} />
                </button>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={silOnay}
        onClose={() => setSilOnay(false)}
        title={`${secili.size} mail silinsin mi?`}
        description="Geri alınamaz. Arşivlemek daha güvenli."
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
