import { NextResponse, type NextRequest } from "next/server";
import { ImapFlow } from "imapflow";
import { createAuthedClient } from "@/lib/supabase/server";

/**
 * SUNUCUDAN DA SİL
 *
 * ┌─ SİLİNEN MAİL GERİ GELİYORDU ⚠️ ──────────────────────────┐
 * │ Panelden silinen mail yalnızca veritabanından gidiyordu;    │
 * │ IMAP sunucusunda duruyordu. Bir sonraki senkronda tekrar    │
 * │ indiriliyor ve gelen kutusunda yeniden beliriyordu.         │
 * │                                                              │
 * │ Artık sunucudaki kopya da siliniyor: önce Çöp klasörüne     │
 * │ taşınıyor, taşınamazsa `\\Deleted` işaretlenip kutu          │
 * │ sıkıştırılıyor.                                              │
 * │                                                              │
 * │ Çöpe TAŞIMAK, doğrudan silmekten iyi: kullanıcı yanlışlıkla │
 * │ sildiyse posta istemcisinden geri alabilir.                 │
 * └──────────────────────────────────────────────────────────────┘
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const govde = (await req.json().catch(() => ({}))) as {
    imap?: { uid: number; folder: string }[];
  };
  const hedefler = (govde.imap ?? []).filter((x) => Number.isFinite(x?.uid));
  if (hedefler.length === 0) return NextResponse.json({ ok: true, silinen: 0 });

  const { data: cfg, error } = await sb.rpc("admin_smtp_secret");
  if (error || !cfg) {
    return NextResponse.json({ error: error?.message ?? "Ayarlar okunamadı" }, { status: 403 });
  }
  const c = cfg as {
    imap: {
      enabled: boolean; host: string | null; port: number; secure: boolean;
      user: string | null; pass: string | null; folder: string; trash_folder: string;
    };
  };

  if (!c.imap.enabled || !c.imap.host || !c.imap.user || !c.imap.pass) {
    // IMAP kapalıysa veritabanı silmesi zaten yeterli
    return NextResponse.json({ ok: true, silinen: 0, imapKapali: true });
  }

  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: c.imap.host, port: c.imap.port, secure: c.imap.secure,
      auth: { user: c.imap.user, pass: c.imap.pass },
      logger: false, greetingTimeout: 12000, socketTimeout: 30000,
    });
    await client.connect();

    // Klasöre göre grupla: her klasör için tek kilit
    const gruplar = new Map<string, number[]>();
    for (const h of hedefler) {
      const f = h.folder || c.imap.folder || "INBOX";
      gruplar.set(f, [...(gruplar.get(f) ?? []), h.uid]);
    }

    let silinen = 0;
    for (const [klasor, uidler] of gruplar) {
      const lock = await client.getMailboxLock(klasor);
      try {
        const aralik = uidler.join(",");
        try {
          // Önce çöpe taşı — geri alınabilir olsun
          await client.messageMove(aralik, c.imap.trash_folder || "Trash", { uid: true });
        } catch {
          /*
           * Çöp klasörü yoksa ya da taşıma desteklenmiyorsa
           * kalıcı silmeye düş. Kullanıcı zaten silmek istedi;
           * yarım bırakmak mailin geri gelmesi demek.
           */
          await client.messageDelete(aralik, { uid: true });
        }
        silinen += uidler.length;
      } finally {
        lock.release();
      }
    }

    await client.logout();
    return NextResponse.json({ ok: true, silinen });
  } catch (err) {
    if (client) { try { client.close(); } catch { /* zaten kapalı */ } }
    /*
     * Sunucudan silinemedi ama veritabanından silindi. Kullanıcıya
     * söylüyoruz: sessizce geçersek mail bir sonraki senkronda
     * geri gelir ve sebebi anlaşılmaz.
     */
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "IMAP silme başarısız" },
      { status: 502 },
    );
  }
}
