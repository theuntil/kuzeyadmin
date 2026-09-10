import { NextResponse, type NextRequest } from "next/server";
import { createAuthedClient } from "@/lib/supabase/server";
import { r2Sil } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * KULLANICIYI TAMAMEN SİL
 *
 * ┌─ İKİ AŞAMALI, SIRASI ÖNEMLİ ⚠️ ───────────────────────────┐
 * │ 1. `admin_delete_user` — profil, haber, yorum, dosya       │
 * │ 2. Mail servisi `/api/auth/delete-user` — auth kaydı       │
 * │                                                              │
 * │ İkinci adım neden burada değil: `auth.users` silmek         │
 * │ `service_role` anahtarı gerektiriyor ve o anahtar YALNIZCA │
 * │ mail servisinde. Panele koymak, tarayıcıya sızma riski     │
 * │ olan bir anahtarı bir sunucuya daha yaymak olurdu.          │
 * │                                                              │
 * │ ⚠ SIRA TERS OLAMAZ. Auth önce silinirse ve içerik silme    │
 * │ hata verirse, giriş yapamayan ama profili duran bir hesap  │
 * │ kalırdı.                                                     │
 * │                                                              │
 * │ ⚠ İKİNCİ ADIM BAŞARISIZ OLURSA UYARILIYOR.                 │
 * │ Sessizce başarı dönmek, tam da şu an yaşanan soruna yol    │
 * │ açıyordu: yönetici sildiğini sanıyor, hesap duruyor.       │
 * └──────────────────────────────────────────────────────────────┘
 */
export async function POST(req: NextRequest) {
  const sb = await createAuthedClient();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { user_id?: string };
  const hedef = String(body.user_id ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hedef)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  /*
   * 0. AŞAMA — SİLİNECEK DOSYALARIN LİSTESİ.
   *
   * ⚠ SİLMEDEN ÖNCE ALINMALI.
   * Profil ve haberler silindikten sonra hangi dosyaların ona
   * ait olduğunu bulmak imkânsız.
   */
  const { data: dosyalar } = await sb.rpc("admin_kullanici_dosyalari", {
    p_user_id: hedef,
  });
  const dosyaListesi = (dosyalar ?? []) as string[];

  /*
   * 1. AŞAMA — içerik ve profil.
   * Yetki kontrolü RPC'nin içinde (`is_admin()`); burada
   * tekrarlamak iki ayrı doğruluk kaynağı yaratırdı.
   */
  const { data: ozet, error } = await sb.rpc("admin_delete_user", {
    p_user_id: hedef,
  });

  if (error) {
    return NextResponse.json(
      { error: "content_delete_failed", detail: error.message },
      { status: 400 },
    );
  }

  /*
   * 2. AŞAMA — DOSYALAR R2'DEN DOĞRUDAN SİLİNİYOR.
   *
   * ⚠ KUYRUĞA BIRAKILMIYOR.
   * `storage_deletions` kuyruğu bot'un temizleyicisini
   * bekliyordu; bot durmuşsa ya da tur aralığı uzunsa profil
   * fotoğrafı saatlerce erişilebilir kalıyordu. Kişisel veride
   * bu gecikme kabul edilemez.
   *
   * Kuyruk yine de dolduruluyor (tetikleyiciler yazıyor) —
   * buradaki doğrudan silme başarısız olursa bot yedek olarak
   * yakalıyor.
   */
  let silinen = 0;
  const basarisiz: string[] = [];

  await Promise.all(
    dosyaListesi.map(async (anahtar) => {
      try {
        await r2Sil(anahtar);
        silinen += 1;
      } catch {
        /*
         * Tek bir dosyanın silinememesi tüm işlemi durdurmuyor:
         * kullanıcı zaten silindi, dosya kuyrukta duruyor.
         */
        basarisiz.push(anahtar);
      }
    }),
  );

  /* 3. AŞAMA — auth kaydı */
  const url = process.env.MAIL_API_URL?.replace(/\/+$/, "");
  const key = process.env.MAIL_API_KEY;

  /*
   * ⚠ EKSİK AYAR AÇIKÇA SÖYLENİYOR.
   * Bu durumda içerik siliniyor ama giriş kaydı duruyor;
   * yönetici aynı e-postayla yeniden kayıt olamıyor ve
   * sebebini bilemiyordu.
   */
  if (!url || !key) {
    /*
     * Mail servisi tanımlı değilse içerik silindi ama auth
     * kaydı duruyor. Bunu gizlemek yönetici için en kötü
     * sonuç: sildiğini sanıp aynı e-postayla kayıt olamaz.
     */
    return NextResponse.json({
      ozet, dosya_silindi: silinen, dosya_kalan: basarisiz.length,
      auth_silindi: false,
      uyari: "giriş kaydı silinemedi: admin servisinde MAIL_API_URL "
           + "ve MAIL_API_KEY tanımlı değil. Bu ayarlar olmadan aynı "
           + "e-postayla yeniden kayıt olunamaz.",
    });
  }

  try {
    const kontrol = new AbortController();
    const zaman = setTimeout(() => kontrol.abort(), 15_000);

    const yanit = await fetch(`${url}/api/auth/delete-user`, {
      method: "POST",
      signal: kontrol.signal,
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ user_id: hedef }),
    });
    clearTimeout(zaman);

    if (!yanit.ok) {
      const j = (await yanit.json().catch(() => ({}))) as { error?: string };
      return NextResponse.json({
        ozet,
        auth_silindi: false,
        uyari: `Giriş kaydı silinemedi (${j.error ?? yanit.status}). `
             + "Kullanıcı içeriği silindi ama aynı e-postayla yeniden "
             + "kayıt olunamaz.",
      });
    }

    return NextResponse.json({
      ozet, auth_silindi: true,
      dosya_silindi: silinen, dosya_kalan: basarisiz.length,
    });
  } catch {
    return NextResponse.json({
      ozet, dosya_silindi: silinen, dosya_kalan: basarisiz.length,
      auth_silindi: false,
      uyari: "Mail servisine ulaşılamadı — giriş kaydı silinemedi.",
    });
  }
}
