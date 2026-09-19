import "server-only";

/**
 * ÇALIŞMA ANINDA YAPILANDIRMA
 *
 * `NEXT_PUBLIC_*` değişkenleri Next.js tarafından DERLEME anında
 * koda gömülür. Bu Docker'da iki sorun çıkarıyordu:
 *
 *   • Dokploy compose-interpolation sırasında değişkenleri her
 *     zaman vermiyor → "variable is not set" uyarısı → boş değer
 *     imaja gömülüyor
 *   • Değer değişince imajı yeniden derlemek gerekiyor
 *
 * Bu yüzden ayarlar sunucuda okunup istemciye PROP olarak
 * geçiriliyor. Panel zaten sunucuda render ediliyor; ek maliyeti
 * yok ve imaj ortamdan bağımsız oluyor.
 */
export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  cdnBase: string;
}

export function getConfig(): PublicConfig {
  // `??` DEĞİL `||`: boş dize de yedeğe düşsün. Dokploy tanımsız
  // değişkeni boş dize olarak geçiriyor ve `??` onu "değer var"
  // sayıyordu.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  /**
   * DERLEME SIRASINDA FIRLATMA.
   *
   * Next.js `/_not-found` sayfasını statik olarak üretiyor ve bu
   * sırada kök layout çalışıyor. Burada hata fırlatılınca derleme
   * şu hatayla duruyordu:
   *
   *   Export encountered an error on /_not-found/page
   *   Next.js build worker exited with code: 1
   *
   * Derleme anında ortam değişkenleri henüz verilmemiş olabilir;
   * bu normaldir. Eksik değer boş dize olarak geçilir, gerçek
   * hata istemci Supabase'e bağlanmaya çalıştığında —
   * yani ÇALIŞMA anında — anlaşılır bir mesajla verilir.
   */

  return {
    supabaseUrl: url.replace(/\/+$/, ""),
    supabaseAnonKey: key,
    siteUrl: (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
              ?? "https://kuzeybatihaber.com.tr").replace(/\/+$/, ""),
    cdnBase: (process.env.CDN_BASE ?? process.env.NEXT_PUBLIC_CDN_BASE
              ?? "https://medya.kuzeybatihaber.com.tr").replace(/\/+$/, ""),
  };
}
