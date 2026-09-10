import "server-only";
import { ImapFlow } from "imapflow";

/**
 * GÖNDERİLEN MAİLİ SUNUCUYA YAZ
 *
 * ┌─ NEDEN GEREKLİ ⚠️ ────────────────────────────────────────┐
 * │ SMTP ve IMAP AYRI protokoller:                             │
 * │   SMTP → maili gönderir, kopyasını saklamaz                │
 * │   IMAP → mailleri saklar, göndermez                        │
 * │                                                              │
 * │ Panelden gönderilen mail alıcıya ulaşıyordu ama             │
 * │ Hostinger'ın kendi arayüzünde "Gönderilmiş" klasörü boş     │
 * │ kalıyordu. Çünkü kopyayı oraya kimse yazmıyordu.            │
 * │                                                              │
 * │ Posta istemcileri (Outlook, Apple Mail) bunu kendileri      │
 * │ yapar: gönderdikten sonra IMAP'a APPEND eder. Biz de        │
 * │ artık ediyoruz.                                              │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ┌─ BAŞARISIZ OLURSA MAİL YİNE GİTMİŞTİR ⚠️ ─────────────────┐
 * │ Bu işlem gönderimden SONRA çalışıyor. Klasör adı yanlışsa  │
 * │ ya da sunucu reddederse kullanıcıya hata göstermiyoruz —    │
 * │ mail zaten alıcıya ulaştı. Yalnızca loga yazılıyor.        │
 * └──────────────────────────────────────────────────────────────┘
 */

export interface ImapKayit {
  host: string; port: number; secure: boolean;
  user: string; pass: string;
  sentFolder: string;
}

/**
 * Hostinger `INBOX.Sent`, Gmail `[Gmail]/Sent Mail`, cPanel
 * `INBOX.Sent` kullanıyor. Yapılandırılan ad tutmazsa sunucunun
 * kendi işaretlediği klasör bulunup oraya yazılıyor.
 */
const YEDEK_ADLAR = [
  "Sent", "INBOX.Sent", "Sent Items", "INBOX.Sent Items",
  "[Gmail]/Sent Mail", "Gesendet", "Gönderilmiş",
];

export async function gonderileneKaydet(
  cfg: ImapKayit,
  ham: Buffer | string,
  log: (...a: unknown[]) => void = () => {},
): Promise<{ ok: boolean; klasor?: string; hata?: string }> {
  let client: ImapFlow | null = null;

  try {
    client = new ImapFlow({
      host: cfg.host, port: cfg.port, secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      logger: false, greetingTimeout: 12000, socketTimeout: 30000,
    });
    await client.connect();

    /*
     * Klasör listesini bir kez al. Sunucu "Sent" klasörünü
     * `\Sent` özel bayrağıyla işaretliyor — ad tahmin etmekten
     * daha güvenilir.
     */
    const klasorler = await client.list();
    const isaretli = klasorler.find(
      (k) => (k.specialUse ?? "").toLowerCase() === "\\sent",
    );

    const adaylar = [
      cfg.sentFolder,
      isaretli?.path,
      ...YEDEK_ADLAR,
    ].filter((x): x is string => Boolean(x));

    // Aynı adı iki kez denemeyelim
    const benzersiz = [...new Set(adaylar)];

    for (const klasor of benzersiz) {
      try {
        await client.append(klasor, ham, ["\\Seen"], new Date());
        await client.logout();
        log("gönderilen kaydedildi:", klasor);
        return { ok: true, klasor };
      } catch {
        /* Bu klasör yok ya da yazılamıyor — sıradakini dene */
      }
    }

    await client.logout();
    return { ok: false, hata: "Gönderilmiş klasörü bulunamadı" };
  } catch (err) {
    if (client) { try { client.close(); } catch { /* zaten kapalı */ } }
    return {
      ok: false,
      hata: err instanceof Error ? err.message : "IMAP bağlantısı kurulamadı",
    };
  }
}
