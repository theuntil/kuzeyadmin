import type { Metadata } from "next";
import { getConfig } from "@/lib/config";
import { requireAdmin } from "@/lib/admin";
import MailList, { type Kutu, type Satir } from "@/components/admin/MailList";
import MailSettingsPanel, { type MailConfig } from "@/components/admin/MailSettingsPanel";
import { Button } from "@/components/ui";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * MAİL EKRANI
 *
 * Kutu adreste taşınıyor (`?kutu=inbox|outbox|starred`) — sekme
 * paylaşılabilir ve geri düğmesi çalışıyor. `?ayar=1` ayarları
 * açıyor; sağ üstteki dişli oraya gidiyor.
 */
export default async function MailPage({
  searchParams,
}: {
  searchParams: Promise<{ kutu?: string; ayar?: string }>;
}) {
  const sp = await searchParams;
  const cfg = getConfig();
  const kutu: Kutu =
    sp.kutu === "outbox" ? "outbox" : sp.kutu === "starred" ? "starred" : "inbox";
  const ayarMod = sp.ayar === "1";

  const { sb } = await requireAdmin(true);

  const [list, mc] = await Promise.all([
    ayarMod
      ? Promise.resolve({ data: [] })
      : sb.from("admin_mail_box").select("*")
          .eq(kutu === "starred" ? "is_starred" : "box",
              kutu === "starred" ? true : kutu)
          .order("tarih", { ascending: false }).limit(50),
    sb.from("admin_mail_config").select("*").maybeSingle(),
  ]);

  const config = (mc.data as unknown as MailConfig) ?? null;

  const SEKME: { k: Kutu; l: string; i: "mail" | "send" | "heart" }[] = [
    { k: "inbox", l: "Gelen postalar", i: "mail" },
    { k: "outbox", l: "Giden postalar", i: "send" },
  ];

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* ── Başlık ── */}
        <header className="flex flex-wrap items-start gap-3">
          {/*
            AYARLARDA GERİ DÜĞMESİ SOLDA.
            Çarpı sağ üstteydi ve "kaydetmeden kapat" gibi
            duruyordu; geri oku nereye döneceğini söylüyor.
          */}
          {ayarMod && (
            <Link href="/mail" aria-label="Mail'e dön"
              className="kb-lift mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-chip text-ink2 transition-colors hover:text-ink">
              <Icon name="back" size={18} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="kb-h1">{ayarMod ? "Mail ayarları" : "Mail"}</h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {config?.from_email ?? "Gönderen adresi tanımlı değil"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!ayarMod && (
              <Link href="/mail?ayar=1" aria-label="Mail ayarları" title="Mail ayarları"
                className="kb-lift flex h-11 w-11 items-center justify-center rounded-[14px] bg-chip text-ink2 transition-colors hover:text-ink">
                <Icon name="settings" size={19} />
              </Link>
            )}
            {!ayarMod && (
              <Button as-child>
                <Link href="/mail/yeni" className="flex items-center gap-2">
                  <Icon name="plus" size={17} /> Yeni mail
                </Link>
              </Button>
            )}
          </div>
        </header>

        {ayarMod ? (
          <MailSettingsPanel initial={config} cdnBase={cfg.cdnBase} />
        ) : (
          <>
            {/* ── Kutu sekmeleri ── */}
            <div className="flex flex-wrap items-center gap-2">
              {SEKME.map((s) => {
                const aktif = kutu === s.k;
                return (
                  <Link
                    key={s.k}
                    href={`/mail?kutu=${s.k}`}
                    className={`kb-lift inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                      aktif ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
                    }`}
                  >
                    <Icon name={s.i} size={16} />
                    {s.l}
                  </Link>
                );
              })}
              {/* Yıldızlı: yalnızca ikon — etiket yer kaplıyordu */}
              <Link
                href="/mail?kutu=starred"
                aria-label="Yıldızlı postalar"
                title="Yıldızlı"
                className={`kb-lift flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors ${
                  kutu === "starred" ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
                }`}
              >
                <Icon name="heart" size={16} />
              </Link>
            </div>

            <MailList kutu={kutu} ilk={(list.data ?? []) as unknown as Satir[]} />
          </>
        )}
      </div>
    </>
  );
}
