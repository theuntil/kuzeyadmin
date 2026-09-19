import "server-only";
import { redirect } from "next/navigation";
import { createAuthedClient } from "./supabase/server";

/**
 * PANEL ERİŞİMİ
 *
 * Tek kapı: her sayfa buradan geçer. Yetkisiz kişi giriş
 * ekranına düşer; panelin içeriğini hiç görmez.
 *
 * Kontrol veritabanında da var (RLS + `is_admin()`); buradaki
 * kontrol sayfayı hiç render etmemek için. İki katman birbirini
 * yedekler.
 */
export type AdminRole = "author" | "admin";

export async function requireAdmin(needAdmin = false) {
  const sb = await createAuthedClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/giris");

  const { data: profile } = await sb
    .from("my_profile")
    .select("role, display_name, username, avatar_url")
    .maybeSingle();

  const role = profile?.role as string | undefined;
  if (role !== "admin" && role !== "author") redirect("/yetkisiz");
  if (needAdmin && role !== "admin") redirect("/");

  return { sb, role: role as AdminRole, profile, userId: auth.user.id };
}
