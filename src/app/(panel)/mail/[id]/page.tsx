import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import MailDetail, { type Detay } from "@/components/admin/MailDetail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function MailDetayPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { sb } = await requireAdmin(true);
  const cfg = getConfig();

  const [detay] = await Promise.all([
    /* Açılınca okundu işaretlenir — ayrı bir istek gerekmiyor */
    sb.rpc("admin_mail_detail", { p_id: id }),
  ]);

  if (detay.error || !detay.data) notFound();

  return (
    <>
      <MailDetail mail={detay.data as unknown as Detay} cdnBase={cfg.cdnBase} />
    </>
  );
}
