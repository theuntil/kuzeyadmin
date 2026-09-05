import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import MailCompose from "@/components/admin/MailCompose";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * YENİ MAİL — AYRI SAYFA
 *
 * Mail ekranının içinde açılınca liste altında kayboluyordu ve
 * sekme değiştirmek yazılanı siliyordu. Ayrı adres olunca geri
 * düğmesi çalışıyor ve form yanlışlıkla kapanmıyor.
 */
export default async function YeniMailPage() {
  const { sb } = await requireAdmin(true);

  const [mc] = await Promise.all([
    sb.from("admin_mail_config").select("from_email, is_enabled, smtp_hazir").maybeSingle(),
  ]);

  const c = mc.data as { from_email?: string | null; is_enabled?: boolean; smtp_hazir?: boolean } | null;

  return (
    <>
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="kb-h1">Yeni mail</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {c?.from_email
              ? `${c.from_email} adresinden gönderilecek`
              : "Gönderen adresi tanımlı değil — Mail ayarlarından gir"}
          </p>
        </header>

        <Link href="/mail"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink">
          ‹ Mail
        </Link>

        {c?.is_enabled === false && (
          <div className="rounded-[14px] bg-orange-soft px-4 py-3 text-[13.5px] text-orange-ink">
            Mail servisi kapalı. <Link href="/mail?ayar=1" className="underline">Mail ayarları</Link>ndan aç.
          </div>
        )}
        {c?.smtp_hazir === false && (
          <div className="rounded-[14px] bg-orange-soft px-4 py-3 text-[13.5px] text-orange-ink">
            SMTP bilgileri eksik. <Link href="/mail?ayar=1" className="underline">Mail ayarları</Link> → SMTP bölümünü doldur.
          </div>
        )}

        <MailCompose gonderen={c?.from_email ?? null} />
      </div>
    </>
  );
}
