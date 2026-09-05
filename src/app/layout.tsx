import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeScript from "@/components/ThemeScript";
import { getConfig } from "@/lib/config";

/**
 * YÖNETİM PANELİ — AYRI SERVİS
 *
 * Siteden bağımsız bir Next.js uygulaması. Kendi Docker
 * konteynerinde, kendi alan adında (ör. panel.kuzeybatihaber.com.tr)
 * çalışır.
 *
 * NEDEN AYRI
 *   • Panel çökse ya da yavaşlasa site etkilenmez
 *   • Panel arama motorlarına hiç açılmaz
 *   • Erişim ağ seviyesinde de kısıtlanabilir (IP, VPN)
 *   • Site paketinde panel kodu taşınmaz — daha küçük paket
 */
export const metadata: Metadata = {
  title: { default: "Yönetim · Kuzeybatı Haber", template: "%s · Yönetim" },
  // Panel hiçbir koşulda dizine eklenmemeli
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0D0F" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

import { ToastProvider } from "@/components/ui/toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = getConfig();

  /**
   * Yapılandırma sayfaya gömülür; tarayıcı istemcisi buradan
   * okur. Yalnızca ANON anahtar var — zaten herkese açık bir
   * değer, gizli olan `service_role` burada bulunmuyor.
   */
  const inject = `window.__KB_CONFIG=${JSON.stringify({
    supabaseUrl: cfg.supabaseUrl,
    supabaseAnonKey: cfg.supabaseAnonKey,
    siteUrl: cfg.siteUrl,
    cdnBase: cfg.cdnBase,
  })};`;

  return (
    <html lang="tr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: inject }} />
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
