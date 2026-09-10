import { NextResponse, type NextRequest } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createAuthedClient } from "@/lib/supabase/server";

/**
 * IMAP SENKRONU
 *
 * ┌─ İKİ AŞAMALI ÇEKİM ⚠️ ────────────────────────────────────┐
 * │ Önce TEK akışta hem UID hem gövde isteniyordu:             │
 * │   fetch(range, { uid: true, source: true, envelope: true }) │
 * │                                                              │
 * │ Bu, sunucudan tüm maillerin ham içeriğini tek seferde       │
 * │ istiyor. Kutu birkaç MB'ı geçince akış yarıda kopuyor,      │
 * │ hata da vermiyor — sessizce boş dönüyordu.                  │
 * │                                                              │
 * │ Artık iki aşama: önce sadece UID listesi (birkaç KB),       │
 * │ sonra her mail TEK TEK `fetchOne` ile. Bir mail bozuksa     │
 * │ yalnızca o atlanıyor.                                        │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ┌─ UID ARALIĞI ⚠️ ──────────────────────────────────────────┐
 * │ `uidNext - 50` gibi hesaplar kırılgandı: silinmiş mailler  │
 * │ yüzünden UID'ler ardışık değil ve aralık boşa düşebiliyor. │
 * │ Artık ilk turda düz `1:*` — sunucu ne varsa versin, biz    │
 * │ listeden son N tanesini seçelim.                             │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Her tur `mail_sync_log` tablosuna yazılıyor. "Neden mail
 * gelmiyor" sorusu artık panelden görülebiliyor.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Tek turda kaç mail indirilsin */
const TUR_LIMIT = 30;
/** İlk senkronda geriye dönük kaç mail */
const ILK_TUR = 50;
/** Kutu birikmişse kaç tur üst üste — istek sonsuza sürmesin */
const MAX_TUR = 5;

const HTML_LIMIT = 900_000;
const TEXT_LIMIT = 200_000;

type Adres = { address?: string; name?: string };

function adresler(v: unknown): string[] | null {
  const o = v as { value?: Adres[] } | undefined;
  const l = o?.value?.map((a) => a.address).filter(Boolean) as string[] | undefined;
  return l && l.length ? l : null;
}

function onizleme(text?: string, html?: string): string {
  const k = text ?? (html ?? "").replace(/<[^>]+>/g, " ");
  return k.replace(/\s+/g, " ").trim().slice(0, 280);
}

/** Sağlayıcı hatasını anlaşılır Türkçeye çevirir */
function acikla(err: unknown): string {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (m.includes("invalid credentials") || m.includes("authentication") ||
      m.includes("login") || m.includes("auth"))
    return "Kullanıcı adı ya da parola yanlış";
  if (m.includes("enotfound") || m.includes("getaddrinfo"))
    return "IMAP sunucu adresi bulunamadı";
  if (m.includes("econnrefused"))
    return "Bağlantı reddedildi — port yanlış olabilir";
  if (m.includes("timeout") || m.includes("etimedout"))
    return "Zaman aşımı — sunucu yanıt vermiyor";
  if (m.includes("wrong version number"))
    return "SSL ayarı porta uymuyor (993 → açık)";
  if (m.includes("nonexistent") || m.includes("does not exist") || m.includes("mailbox"))
    return "Klasör bulunamadı — Hostinger'da INBOX, Gmail'de [Gmail]/... olabilir";
  return err instanceof Error ? err.message : "Bilinmeyen hata";
}

/**
 * GET ve POST aynı işi yapıyor.
 *
 * Panel POST atıyor; arka plan cron'u GET atmak zorunda
 * (`pg_net.http_get` ve `curl` varsayılanı GET).
 */
export async function GET(req: NextRequest) { return calis(req); }
export async function POST(req: NextRequest) { return calis(req); }

async function calis(req: NextRequest) {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();

  /*
   * ⚠ OTURUMSUZ ERİŞİM — YALNIZCA ANAHTARLA.
   *
   * Panel kapalıyken de mail kontrol edilmeli. Cron'un oturumu
   * yok; onun yerine veritabanında tutulan gizli anahtarı
   * taşıyor. Anahtar panele hiç gitmiyor, yalnızca cron biliyor.
   */
  if (!auth.user) {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    }
    const { data: gecerli } = await sb.rpc("mail_sync_token_dogrula", {
      p_token: token,
    });
    if (gecerli !== true) {
      return NextResponse.json({ error: "Geçersiz anahtar" }, { status: 403 });
    }
  }

  /* `?elle=1` → bekleme kuralını atla (yenile düğmesi) */
  const elle = req.nextUrl.searchParams.get("elle") === "1";
  const basladi = Date.now();

  const { data: alindi, error: kilitErr } = await sb.rpc("mail_sync_al", {
    p_saniye: elle ? 0 : 8,
  });
  if (kilitErr) return NextResponse.json({ error: kilitErr.message }, { status: 403 });
  if (alindi !== true) {
    return NextResponse.json({ ok: true, atlandi: true, yeni: 0 });
  }

  let asama = "baslangic";
  let hata: string | null = null;
  let client: ImapFlow | null = null;

  let klasor = "INBOX";
  let kutuda = 0;
  let bulunan = 0;
  let cekilen = 0;
  let yazilan = 0;
  let kopya = 0;
  let hatali = 0;
  /** Yazılamayan maillerin sebepleri — panelde görünüyor */
  const ayrinti: { uid?: string; konu?: string; hata?: string }[] = [];
  let sonUid = 0;
  /* Gönderilmiş klasörü ayrı takip ediliyor: IMAP UID'leri
     klasör başına bağımsız, tek sayaç biri diğerini ezerdi. */
  let sentKlasor = "INBOX.Sent";
  let sonUidSent = 0;
  let sentYazilan = 0;

  try {
    asama = "ayarlar";
    const { data: cfg, error } = await sb.rpc("admin_smtp_secret");
    if (error || !cfg) throw new Error(error?.message ?? "Ayarlar okunamadı");

    const c = cfg as {
      imap: {
        enabled: boolean; host: string | null; port: number; secure: boolean;
        user: string | null; pass: string | null; folder: string; last_uid: number;
        sent_folder: string; last_uid_sent: number;
      };
    };

    if (!c.imap.enabled) {
      await sb.rpc("mail_sync_birak", { p_last_uid: null, p_eklenen: 0, p_hata: null });
      return NextResponse.json({ ok: true, kapali: true, yeni: 0 });
    }
    if (!c.imap.host || !c.imap.user || !c.imap.pass) {
      throw new Error("IMAP bilgileri eksik — sunucu, kullanıcı ve parola gerekli");
    }

    klasor = c.imap.folder || "INBOX";
    sonUid = Number(c.imap.last_uid ?? 0);
    sentKlasor = c.imap.sent_folder || "INBOX.Sent";
    sonUidSent = Number(c.imap.last_uid_sent ?? 0);

    asama = "baglanti";
    client = new ImapFlow({
      host: c.imap.host, port: c.imap.port, secure: c.imap.secure,
      auth: { user: c.imap.user, pass: c.imap.pass },
      logger: false, greetingTimeout: 15000, socketTimeout: 60000,
    });
    await client.connect();

    asama = "klasor";
    const lock = await client.getMailboxLock(klasor);

    try {
      const kutu = client.mailbox;
      if (!kutu || typeof kutu === "boolean") throw new Error("Klasör açılamadı");
      kutuda = Number(kutu.exists ?? 0);

      /*
       * KUTU BOŞALANA KADAR TUR AT.
       * Birikmiş kutuda tek istekte hepsi gelsin diye; üst sınır
       * var ki istek sonsuza kadar sürmesin.
       */
      for (let tur = 0; tur < MAX_TUR; tur++) {
        asama = `uid-listesi-${tur + 1}`;

        /* ---- 1. AŞAMA: yalnızca UID'ler ---- */
        const aralik = sonUid > 0 ? `${sonUid + 1}:*` : "1:*";
        const uidler: number[] = [];
        for await (const msg of client.fetch(aralik, { uid: true }, { uid: true })) {
          const u = Number(msg.uid);
          if (u > sonUid) uidler.push(u);
        }
        uidler.sort((a, b) => a - b);
        bulunan += uidler.length;

        if (uidler.length === 0) break;

        /*
         * İLK senkron: en YENİ N tanesi (geçmişi indirmeyelim).
         * Sonraki senkronlar: en ESKİDEN başla ki son UID
         * kesintisiz ilerlesin ve aradan mail düşmesin.
         */
        const secilen = sonUid === 0
          ? uidler.slice(-ILK_TUR)
          : uidler.slice(0, TUR_LIMIT);

        asama = `indirme-${tur + 1}`;
        const toplu: Record<string, unknown>[] = [];

        /* ---- 2. AŞAMA: her mail tek tek ---- */
        for (const uid of secilen) {
          try {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
            if (!msg || typeof msg === "boolean" || !msg.source) {
              // Bozuk kayıt: UID ilerlesin, yoksa her turda burada takılırız
              sonUid = Math.max(sonUid, uid);
              continue;
            }

            const m = await simpleParser(msg.source);
            const from = m.from?.value?.[0] as Adres | undefined;
            const to = adresler(m.to as unknown);
            const html = typeof m.html === "string" ? m.html : undefined;
            const text = m.text ?? undefined;

            const ekler = (m.attachments ?? [])
              .filter((a) => a.contentDisposition !== "inline")
              .map((a) => ({
                filename: a.filename ?? null,
                size: a.size ?? 0,
                contentType: a.contentType ?? "application/octet-stream",
              }));

            toplu.push({
              subject: m.subject?.slice(0, 500) ?? null,
              preview: onizleme(text, html),
              from_email: (from?.address ?? "bilinmiyor@yok").toLowerCase(),
              from_name: from?.name || null,
              to_email: to?.[0] ?? null,
              to_list: to,
              cc_list: adresler(m.cc as unknown),
              body_html: html?.slice(0, HTML_LIMIT) ?? null,
              body_text: text?.slice(0, TEXT_LIMIT) ?? null,
              has_attachments: ekler.length > 0,
              attachments: ekler,
              message_id: m.messageId ?? null,
              in_reply_to: m.inReplyTo ?? null,
              imap_uid: String(uid),
              folder: klasor,
              received_at: (m.date ?? new Date()).toISOString(),
            });
            cekilen += 1;
          } catch {
            /* Tek bozuk mail turu durdurmasın */
          }
          sonUid = Math.max(sonUid, uid);
        }

        if (toplu.length) {
          asama = `yazma-${tur + 1}`;
          const { data: sonuc, error: yazErr } = await sb.rpc("mail_inbox_bulk", {
            p_mails: toplu,
          });
          if (yazErr) throw new Error("Veritabanına yazılamadı: " + yazErr.message);

          /*
           * Fonksiyon artık ayrıntı döndürüyor: kaç yazıldı, kaçı
           * zaten vardı, kaçı hata verdi ve NEDEN. Eskiden yalnızca
           * sayı dönüyordu ve "16 mail var ama hiçbiri gelmiyor"
           * durumunun sebebi görünmüyordu.
           */
          const s = sonuc as {
            yeni?: number; kopya?: number; hata?: number;
            hatalar?: { uid?: string; konu?: string; hata?: string }[];
          } | null;

          yazilan += Number(s?.yeni ?? 0);
          kopya   += Number(s?.kopya ?? 0);
          hatali  += Number(s?.hata ?? 0);
          for (const h of s?.hatalar ?? []) {
            if (ayrinti.length < 10) ayrinti.push(h);
          }
        }

        // Sırada bekleyen kaldı mı?
        if (uidler.length <= secilen.length) break;
      }
    } finally {
      lock.release();
    }

    /* ════ GÖNDERİLMİŞ KLASÖRÜ ════
     *
     * Hostinger'ın web arayüzünden ya da telefondan atılan
     * mailler yalnızca burada duruyor. Taranmazsa panelde
     * "Giden postalar" eksik kalıyor.
     *
     * Klasör adı yanlışsa senkronun TAMAMI durmasın: kendi
     * try/catch'inde.
     */
    try {
      asama = "sent-klasor";
      const sentAdaylar = [sentKlasor, "Sent", "INBOX.Sent", "Sent Items"];
      let acildi = false;

      for (const aday of [...new Set(sentAdaylar)]) {
        let sLock: Awaited<ReturnType<typeof client.getMailboxLock>> | null = null;
        try {
          sLock = await client.getMailboxLock(aday);
        } catch {
          continue;   // bu klasör yok, sıradakini dene
        }

        try {
          acildi = true;
          sentKlasor = aday;

          const sAralik = sonUidSent > 0 ? `${sonUidSent + 1}:*` : "1:*";
          const sUidler: number[] = [];
          for await (const msg of client.fetch(sAralik, { uid: true }, { uid: true })) {
            const u = Number(msg.uid);
            if (u > sonUidSent) sUidler.push(u);
          }
          sUidler.sort((a, b) => a - b);

          const sSecilen = sonUidSent === 0
            ? sUidler.slice(-ILK_TUR)
            : sUidler.slice(0, TUR_LIMIT);

          const sToplu: Record<string, unknown>[] = [];
          for (const uid of sSecilen) {
            try {
              const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
              if (!msg || typeof msg === "boolean" || !msg.source) {
                sonUidSent = Math.max(sonUidSent, uid);
                continue;
              }
              const m = await simpleParser(msg.source);
              const from = m.from?.value?.[0] as Adres | undefined;
              const to = adresler(m.to as unknown);
              const html = typeof m.html === "string" ? m.html : undefined;
              const text = m.text ?? undefined;
              const ekler = (m.attachments ?? [])
                .filter((a) => a.contentDisposition !== "inline")
                .map((a) => ({
                  filename: a.filename ?? null,
                  size: a.size ?? 0,
                  contentType: a.contentType ?? "application/octet-stream",
                }));

              sToplu.push({
                subject: m.subject?.slice(0, 500) ?? null,
                preview: onizleme(text, html),
                from_email: from?.address ?? null,
                from_name: from?.name || null,
                to_email: to?.[0] ?? null,
                to_list: to,
                cc_list: adresler(m.cc as unknown),
                body_html: html?.slice(0, HTML_LIMIT) ?? null,
                body_text: text?.slice(0, TEXT_LIMIT) ?? null,
                has_attachments: ekler.length > 0,
                attachments: ekler,
                message_id: m.messageId ?? null,
                in_reply_to: m.inReplyTo ?? null,
                imap_uid: String(uid),
                folder: aday,
                sent_at: (m.date ?? new Date()).toISOString(),
              });
            } catch { /* tek bozuk mail turu durdurmasın */ }
            sonUidSent = Math.max(sonUidSent, uid);
          }

          if (sToplu.length) {
            const { data: sr } = await sb.rpc("mail_outbox_bulk", { p_mails: sToplu });
            const ss = sr as { yeni?: number } | null;
            sentYazilan += Number(ss?.yeni ?? 0);
          }
        } finally {
          sLock.release();
        }
        break;   // klasör bulundu, diğer adayları deneme
      }

      if (!acildi) {
        console.warn("[mail-sync] Gönderilmiş klasörü bulunamadı");
      }
    } catch (e) {
      // Sent taranamadıysa INBOX sonuçları yine geçerli
      console.warn("[mail-sync] Sent klasörü taranamadı:",
        e instanceof Error ? e.message : e);
    }

    asama = "tamam";
    await client.logout();
    client = null;
  } catch (err) {
    hata = acikla(err);
    if (client) { try { client.close(); } catch { /* zaten kapalı */ } }
  }

  // Kiralama HER DURUMDA bırakılır; yoksa gelen kutusu donardı
  await sb.rpc("mail_sync_birak", {
    p_last_uid: sonUid || null,
    p_eklenen: yazilan + sentYazilan,
    p_hata: hata,
    p_last_uid_sent: sonUidSent || null,
  });

  /* Tanılama günlüğü — panelde görünür */
  try {
    await sb.rpc("mail_sync_logla", {
      p: {
        ok: hata === null && hatali === 0, asama, klasor,
        kutuda, bulunan, cekilen, yazilan, kopya, hatali,
        ayrinti,
        son_uid: sonUid, sure_ms: Date.now() - basladi, hata,
      },
    });
  } catch { /* günlük yazılamazsa senkron yine de oldu */ }

  if (hata) {
    return NextResponse.json(
      { ok: false, error: hata, asama, klasor, kutuda, bulunan },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true, yeni: yazilan + sentYazilan, klasor, kutuda, bulunan, cekilen,
    giden: sentYazilan, sentKlasor,
    kopya, hatali, ayrinti, sonUid,
  });
}
