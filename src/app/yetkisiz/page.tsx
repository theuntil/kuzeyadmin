"use client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, H3, EmptyState } from "@/components/ui";

/**
 * Giriş yapmış ama yetkisi olmayan kullanıcı buraya düşer.
 * Panelin bölümleri hakkında ipucu verilmez.
 */
export default function Unauthorized() {
  async function logout() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/giris";
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-page px-5">
      <div className="w-full max-w-[420px]">
        <EmptyState
          title="Bu alana erişimin yok"
          description="Yönetim paneli yalnızca yazar ve yöneticilere açık."
          action={<Button variant="outline" onClick={logout}>Çıkış yap</Button>}
        />
      </div>
    </div>
  );
}
