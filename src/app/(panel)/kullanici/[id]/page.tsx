import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import UserDetail, { type UserFull, type UserComment } from "@/components/admin/UserDetail";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * KULLANICI DETAYI
 *
 * Listede hiçbir işlem yok; hepsi burada. Veri üç çağrıyla
 * geliyor ve `Promise.all` ile paralel — sıralı yapılsa üç
 * gidiş-dönüş beklenirdi.
 */
export default async function UserPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { sb, userId } = await requireAdmin(true);
  const cfg = getConfig();

  const [user, comments, cities] = await Promise.all([
    sb.rpc("admin_user_full", { p_id: id }),
    sb.rpc("admin_user_comments", { p_id: id, p_limit: 50 }),
    sb.from("cities").select("id, name").eq("is_active", true).order("name"),
  ]);

  if (user.error || !user.data) notFound();

  return (
    <>
      <Link href="/kullanici"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink">
        ← Kullanıcılar
      </Link>
      <UserDetail
        user={user.data as unknown as UserFull}
        comments={(comments.data ?? []) as unknown as UserComment[]}
        cities={(cities.data ?? []) as { id: string; name: string }[]}
        cdnBase={cfg.cdnBase}
        meId={userId}
      />
    </>
  );
}
