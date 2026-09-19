import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAuthedClient } from "@/lib/supabase/server";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giriş" };

/**
 * PANEL GİRİŞİ
 *
 * Kayıt yok, sosyal giriş yok: panele yalnızca sitede zaten
 * hesabı olan ve rolü yükseltilmiş kişiler girer. Ayrı bir kayıt
 * yolu açmak gereksiz bir saldırı yüzeyi olurdu.
 */
export default async function LoginPage() {
  const sb = await createAuthedClient();
  const { data } = await sb.auth.getUser();
  if (data.user) redirect("/");
  return <LoginForm />;
}
