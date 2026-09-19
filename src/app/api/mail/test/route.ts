import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { createAuthedClient } from "@/lib/supabase/server";

/**
 * BAĞLANTI TESTİ
 *
 * ┌─ KAYDETMEDEN DENEYEBİLMELİ ⚠️ ────────────────────────────┐
 * │ Kullanıcı bir ayarı düzeltip önce test etmek istiyor.      │
 * │ Kaydetmeye zorlarsak yanlış ayar canlıya girer ve o sırada │
 * │ gerçek mailler başarısız olur.                              │
 * │                                                              │
 * │ Bu yüzden istekte gelen DEĞİŞİKLİKLER kayıtlı ayarın        │
 * │ üstüne biniyor; veritabanına hiçbir şey yazılmıyor.         │
 * └──────────────────────────────────────────────────────────────┘
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

/** Sağlayıcı hatalarını anlaşılır Türkçeye çevirir */
function acikla(err: unknown): string {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (m.includes("invalid login") || m.includes("authentication") || m.includes("auth"))
    return "Kullanıcı adı ya da parola yanlış";
  if (m.includes("enotfound") || m.includes("getaddrinfo"))
    return "Sunucu adresi bulunamadı — yazımı kontrol et";
  if (m.includes("econnrefused"))
    return "Bağlantı reddedildi — port yanlış olabilir";
  if (m.includes("timeout") || m.includes("etimedout"))
    return "Zaman aşımı — sunucu yanıt vermiyor ya da port kapalı";
  if (m.includes("certificate") || m.includes("self signed"))
    return "Sertifika doğrulanamadı — SSL ayarını kontrol et";
  if (m.includes("wrong version number"))
    return "SSL ayarı porta uymuyor (465 → açık, 587 → kapalı)";
  return err instanceof Error ? err.message : "Bağlantı kurulamadı";
}

export async function POST(req: NextRequest) {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const yama = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tur = yama.tur === "imap" ? "imap" : "smtp";

  const { data: cfg, error } = await sb.rpc("admin_smtp_secret");
  if (error || !cfg) {
    return NextResponse.json({ error: error?.message ?? "Ayarlar okunamadı" }, { status: 403 });
  }

  const c = cfg as {
    smtp: { host: string | null; port: number; secure: boolean; user: string | null; pass: string | null };
    imap: { host: string | null; port: number; secure: boolean; user: string | null; pass: string | null; folder: string };
  };

  const say = (v: unknown, y: number) => (v === undefined || v === "" ? y : Number(v));
  const str = (v: unknown, y: string | null) => (v === undefined || v === "" ? y : String(v));
  const bul = (v: unknown, y: boolean) => (v === undefined ? y : Boolean(v));

  try {
    if (tur === "smtp") {
      const host = str(yama.smtp_host, c.smtp.host);
      const user = str(yama.smtp_user, c.smtp.user);
      const pass = str(yama.smtp_pass, c.smtp.pass);
      if (!host || !user || !pass) {
        return NextResponse.json({ ok: false, mesaj: "Sunucu, kullanıcı ve parola gerekli" });
      }

      const tx = nodemailer.createTransport({
        host, port: say(yama.smtp_port, c.smtp.port),
        secure: bul(yama.smtp_secure, c.smtp.secure),
        auth: { user, pass },
        connectionTimeout: 15000, greetingTimeout: 10000,
      });
      await tx.verify();
      tx.close();
      return NextResponse.json({ ok: true, mesaj: `Bağlandı: ${host}` });
    }

    const host = str(yama.imap_host, c.imap.host);
    const user = str(yama.imap_user, c.imap.user);
    const pass = str(yama.imap_pass, c.imap.pass);
    if (!host || !user || !pass) {
      return NextResponse.json({ ok: false, mesaj: "Sunucu, kullanıcı ve parola gerekli" });
    }

    const client = new ImapFlow({
      host, port: say(yama.imap_port, c.imap.port),
      secure: bul(yama.imap_secure, c.imap.secure),
      auth: { user, pass },
      logger: false, greetingTimeout: 12000, socketTimeout: 25000,
    });
    await client.connect();

    /* Klasör de açılabiliyor mu? Bağlanmak yetmez — yanlış klasör
       adı en sık yapılan hata ve yalnızca burada anlaşılır. */
    const klasor = str(yama.imap_folder, c.imap.folder) ?? "INBOX";
    const lock = await client.getMailboxLock(klasor);
    const kutu = client.mailbox;
    const adet = kutu && typeof kutu !== "boolean" ? kutu.exists : 0;
    lock.release();
    await client.logout();

    return NextResponse.json({
      ok: true, mesaj: `Bağlandı: ${klasor} klasöründe ${adet} mail`,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, mesaj: acikla(err) });
  }
}
