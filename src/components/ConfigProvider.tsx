"use client";
import { createContext, useContext, type ReactNode } from "react";

export interface PublicConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  cdnBase: string;
}

/**
 * Sunucudan gelen yapılandırmayı istemci bileşenlerine taşır.
 * Böylece `NEXT_PUBLIC_*` gömülü değerlere ihtiyaç kalmıyor.
 */
const Ctx = createContext<PublicConfig | null>(null);

export function ConfigProvider({
  value, children,
}: { value: PublicConfig; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConfig(): PublicConfig {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfig, ConfigProvider içinde kullanılmalı");
  return c;
}
