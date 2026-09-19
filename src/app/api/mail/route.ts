import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { createAuthedClient } from "@/lib/supabase/server";
import { ekleriIndir } from "@/lib/mail-ek";
import { mailHtml } from "@/lib/mail-sablon";
import { gonderileneKaydet } from "@/lib/mail-imap-kaydet";

/**
 * PANELDEN MAİL GÖNDER — DOĞRUDAN
 *
 * ┌─ KUYRUK KALDIRILDI ⚠️ ────────────────────────────────────┐
 * │ Önce mail kuyruğa yazılıyor, ayrı bir Docker servisi onu   │
 * │ çekip gönderiyordu. Üç yerde yapılandırma gerekiyordu       │
 * │ (panel, mail servisi, R2) ve biri eksikse mail SESSİZCE    │
 * │ kuyrukta kalıyordu — panel "gönderildi" diyordu çünkü      │
 * │ kuyruğa yazmak başarılıydı.                                 │
 * │                                                              │
 * │ Artık mail buradan ANINDA gidiyor. Hata varsa kullanıcı     │
 * │ o anda görüyor: "SMTP kimlik doğrulaması başarısız" gibi.   │
 * │                                                              │
 * │ Doğrulama/hoş geldin/şifre mailleri kuyrukta KALDI —        │
 * │ kullanıcı onları beklemiyor, yeniden deneme orada anlamlı.  │
 * └──────────────────────────────────────────────────────────────┘
 *
 * SMTP parolası burada okunuyor ama TARAYICIYA GİTMİYOR: bu bir
 * sunucu rotası, yanıtta yalnızca sonuç var.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** SMTP el sıkışması + ek yükleme; Vercel varsayılanı 10 sn yetmez */
export const maxDuration = 60;

interface Govde {
  to?: string[];
  subject?: string;
  heading?: string;
  body?: string;
  is_html?: boolean;
  partner_logo?: string | null;
  attachments?: { key: string; name: string; size: number; type: string }[];
  reply_to_id?: string | null;
  in_reply_to?: string | null;
}

export async function POST(req: NextRequest) {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }

  let g: Govde;
  try { g = (await req.json()) as Govde; }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const alicilar = (g.to ?? [])
    .map((x) => String(x).trim().toLowerCase())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x));

  if (alicilar.length === 0) {
    return NextResponse.json({ error: "Geçerli alıcı yok" }, { status: 400 });
  }
  if (alicilar.length > 50) {
    return NextResponse.json({ error: "Tek seferde en fazla 50 alıcı" }, { status: 400 });
  }
  if (!g.subject?.trim()) {
    return NextResponse.json({ error: "Konu boş olamaz" }, { status: 400 });
  }
  if (!g.body?.trim()) {
    return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });
  }

  /* ---- Ayarlar (yetki fonksiyonun içinde kontrol ediliyor) ---- */
  const { data: cfg, error: cfgErr } = await sb.rpc("admin_smtp_secret");
  if (cfgErr || !cfg) {
    return NextResponse.json(
      { error: cfgErr?.message ?? "Mail ayarları okunamadı" },
      { status: 403 },
    );
  }

  const c = cfg as {
    is_enabled: boolean; from_name: string | null; from_email: string | null;
    reply_to: string | null;
    smtp: { host: string | null; port: number; secure: boolean; user: string | null; pass: string | null };
    brand: { name: string | null; logo_url: string | null; site_url: string | null;
             footer_note: string | null; signature_html: string | null;
             hero_image_key: string | null };
    imap: { enabled: boolean; host: string | null; port: number; secure: boolean;
            user: string | null; pass: string | null; sent_folder: string;
            save_sent: boolean };
  };

  if (!c.is_enabled) {
    return NextResponse.json(
      { error: "Mail servisi kapalı. Mail ayarlarından aç." }, { status: 400 },
    );
  }
  if (!c.smtp.host || !c.smtp.user || !c.smtp.pass) {
    return NextResponse.json(
      { error: "SMTP bilgileri eksik. Mail ayarları → SMTP bölümünü doldur." },
      { status: 400 },
    );
  }

  /* ---- Ekler ---- */
  let ekler: Awaited<ReturnType<typeof ekleriIndir>> = [];
  try {
    ekler = await ekleriIndir(g.attachments ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ekler hazırlanamadı" },
      { status: 400 },
    );
  }

  /* ---- Görseller ---- */
  const cdn = (process.env.CDN_BASE ?? "").replace(/\/+$/, "");
  const tam = (k: string | null) =>
    !k ? null : /^https?:\/\//.test(k) ? k : cdn ? `${cdn}/${k}` : null;

  /*
   * LOGO GÖRÜNÜM AYARLARINDAN GELİYOR.
   *
   * Mail ayarlarında ayrıca logo sorulmuyor. Koyu zeminde
   * okunan sürüm tercih ediliyor: mail istemcisinin temasını
   * sunucuda bilemeyiz ve logolar genelde beyaz üzerine
   * çiziliyor — koyu sürüm her iki durumda da okunuyor.
   * Koyu sürüm yoksa açık sürüme düşülüyor.
   */
  const { data: ss } = await sb
    .from("public_site_settings")
    .select("logo_dark_key, logo_light_key")
    .maybeSingle();
  const logoKey = (ss?.logo_dark_key ?? ss?.logo_light_key) as string | null;

  /* ---- Gövde ---- */
  const html = mailHtml({
    subject: g.subject,
    heading: g.heading ?? null,
    body: g.body,
    isHtml: Boolean(g.is_html),
    partnerLogo: tam(g.partner_logo ?? null),
    heroImage: tam(c.brand.hero_image_key),
    ourLogo: tam(logoKey) ?? tam(c.brand.logo_url),
    brand: c.brand,
  });
  const text = g.is_html
    ? g.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : g.body;

  /*
   * GÖNDEREN ADRESİ.
   * Çoğu SMTP sunucusu `From`un kimlik doğrulanan hesaba ait
   * olmasını zorunlu tutuyor (553 Sender address rejected).
   * Paneldeki adres farklıysa SMTP kullanıcısına düşülür.
   */
  const from = c.from_email && c.from_email.toLowerCase() === c.smtp.user.toLowerCase()
    ? c.from_email
    : c.smtp.user;

  const tx = nodemailer.createTransport({
    host: c.smtp.host, port: c.smtp.port, secure: c.smtp.secure,
    auth: { user: c.smtp.user, pass: c.smtp.pass },
    connectionTimeout: 20000, greetingTimeout: 15000, socketTimeout: 40000,
  });

  let hata: string | null = null;
  let ham: Buffer | null = null;

  /*
   * ⚠ MESAJ ÖNCE OLUŞTURULUYOR, SONRA GÖNDERİLİYOR.
   *
   * `streamTransport` hiçbir yere göndermez — yalnızca RFC 5322
   * biçiminde ham iletiyi üretir. Aynı ham ileti hem SMTP'ye
   * hem IMAP'a veriliyor.
   *
   * Neden böyle: SMTP taşıyıcısı `sendMail`den ham iletiyi
   * DÖNDÜRMÜYOR (yalnızca messageId ve yanıt kodu). İkinci kez
   * üretsek sınır dizeleri (`boundary`) ve `Message-ID` farklı
   * olurdu — sunucudaki kopya gönderilenle aynı olmazdı.
   */
  const iletiMesaj = {
    from: `"${c.from_name ?? c.brand.name ?? "Kuzeybatı Haber"}" <${from}>`,
    replyTo: c.reply_to ?? undefined,
    to: alicilar.length === 1 ? alicilar[0] : from,
    bcc: alicilar.length > 1 ? alicilar : undefined,
    subject: g.subject,
    text, html,
    attachments: ekler.length ? ekler : undefined,
    inReplyTo: g.in_reply_to ?? undefined,
    references: g.in_reply_to ? [g.in_reply_to] : undefined,
  };

  try {
    const olustur = nodemailer.createTransport({
      streamTransport: true, buffer: true, newline: "unix",
    });
    const uretilen = await olustur.sendMail(iletiMesaj);
    const um = uretilen as unknown as { message?: Buffer };
    if (um.message) ham = Buffer.from(um.message);
  } catch {
    /* Ham üretilemezse gönderim yine yapılacak, yalnızca
       sunucudaki kopya atlanacak */
  }

  try {
    if (ham) {
      /*
       * Hazır ham iletiyi gönder. `envelope` elle veriliyor:
       * `raw` kullanınca nodemailer başlıklardan alıcı çıkarmaz
       * ve `bcc` gizli olduğu için hiç kimseye gitmezdi.
       */
      await tx.sendMail({
        envelope: { from, to: alicilar },
        raw: ham,
      });
    } else {
      await tx.sendMail(iletiMesaj);
    }
  } catch (err) {
    hata = err instanceof Error ? err.message : String(err);
  } finally {
    tx.close();
  }

  /*
   * ---- Gönderilmiş klasörüne kopyala ----
   *
   * Mail gittikten SONRA. Başarısız olursa kullanıcıya hata
   * gösterilmiyor: mail zaten alıcıya ulaştı, yalnızca
   * sunucudaki kopyası eksik kalıyor.
   */
  if (hata === null && ham && c.imap?.save_sent && c.imap.host &&
      c.imap.user && c.imap.pass) {
    const kayit = await gonderileneKaydet(
      {
        host: c.imap.host, port: c.imap.port, secure: c.imap.secure,
        user: c.imap.user, pass: c.imap.pass,
        sentFolder: c.imap.sent_folder || "INBOX.Sent",
      },
      ham,
      (...a) => console.log("[mail]", ...a),
    );
    if (!kayit.ok) {
      console.warn("[mail] Gönderilmiş klasörüne yazılamadı:", kayit.hata);
    }
  }

  /* ---- Sonucu kaydet (başarısız da olsa görünsün) ---- */
  await sb.rpc("admin_mail_record", {
    p: {
      ok: hata === null,
      to: alicilar[0],
      to_list: alicilar,
      subject: g.subject,
      body: g.body,
      body_text: g.is_html ? null : g.body,
      body_html: g.is_html ? g.body : html,
      in_reply_to: g.in_reply_to ?? null,
      error: hata,
      attachments: g.attachments ?? [],
    },
  });

  if (hata) {
    return NextResponse.json({ error: hata }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    mesaj: alicilar.length === 1
      ? "Mail gönderildi"
      : `${alicilar.length} alıcıya gönderildi`,
  });
}
