/**
 * Sitenin adresi.
 *
 * Panel ayrı alan adında; habere ya da hesap sayfasına bağlantı
 * verirken tam adres gerekiyor. Çalışma anında sayfaya gömülen
 * yapılandırmadan okunur.
 */
export const SITE =
  (typeof window !== "undefined" && window.__KB_CONFIG
    ? (window.__KB_CONFIG as { siteUrl?: string }).siteUrl
    : undefined) ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kuzeybatihaber.com.tr";
