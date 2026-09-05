import { SITE } from "@/lib/site";
import Link from "next/link";

/**
 * 404 — kök layout'la aynı zeminde, ek veri istemiyor.
 * Derleme sırasında statik üretildiği için hiçbir ortam
 * değişkenine bağımlı olmamalı.
 */
export default function NotFound() {
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "24px 20px", textAlign: "center",
    }}>
      <div style={{ maxWidth: 360 }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-.04em" }}>404</h1>
        <p style={{ fontSize: 15, color: "var(--mu)", marginTop: 8, lineHeight: 1.6 }}>
          Aradığın sayfa bulunamadı.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginTop: 22, height: 46, padding: "0 22px", borderRadius: 12,
            background: "var(--tx)", color: "var(--bg)",
            fontSize: 14.5, fontWeight: 700,
          }}
        >
          Panele dön
        </Link>
      </div>
    </div>
  );
}
