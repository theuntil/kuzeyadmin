"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * TARAYICI İSTEMCİSİ
 *
 * ┌─ SUNUCUDA DA ÇALIŞMASI GEREKİYOR ⚠️ ───────────────────────┐
 * │ Bu dosya `"use client"` ama Next.js istemci bileşenlerini   │
 * │ İLK YÜKLEMEDE SUNUCUDA da render eder (SSR). O anda:        │
 * │   • `window` YOK  → `__KB_CONFIG` okunamaz                  │
 * │   • `NEXT_PUBLIC_*` BOŞ → çünkü artık kullanmıyoruz         │
 * │                                                              │
 * │ Eskiden burada hata fırlatılıyordu ve sayfaların çoğu        │
 * │ 500 veriyordu:                                               │
 * │   Error: Supabase ayarları bulunamadı...                     │
 * │   at .next/server/app/[[...section]]/page.js                 │
 * │                                                              │
 * │ Çözüm: sunucuda `process.env.SUPABASE_URL` okunuyor.         │
 * │ Tarayıcıda o değişken yok ama `__KB_CONFIG` var.            │
 * └──────────────────────────────────────────────────────────────┘
 */
declare global {
  interface Window {
    __KB_CONFIG?: { supabaseUrl: string; supabaseAnonKey: string };
  }
}

/** Ortam değişkenini güvenle oku — tarayıcıda `process` olmayabilir */
function env(ad: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[ad] || undefined;
}

export function supabaseConfig(): { url: string; key: string } {
  const cfg = typeof window !== "undefined" ? window.__KB_CONFIG : undefined;

  const url =
    cfg?.supabaseUrl ||
    env("SUPABASE_URL") ||
    env("NEXT_PUBLIC_SUPABASE_URL") ||
    "";
  const key =
    cfg?.supabaseAnonKey ||
    env("SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    "";

  return { url: url.replace(/\/+$/, ""), key };
}

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function supabaseBrowser() {
  if (!cached) {
    const { url, key } = supabaseConfig();

    if (!url || !key) {
      throw new Error(
        "Supabase ayarları bulunamadı. Dokploy → Environment sekmesinde " +
        "SUPABASE_URL ve SUPABASE_ANON_KEY tanımlı olmalı.",
      );
    }
    cached = createBrowserClient(url, key);
  }
  return cached;
}
