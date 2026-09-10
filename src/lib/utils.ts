/** Koşullu sınıf birleştirici */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export type ToneName = "green" | "orange" | "danger" | "accent" | "muted";

/** Sayı — Türkçe biçim */
export function n(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("tr-TR");
}

/** Tarih — kısa */
export function d(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("tr-TR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/** Tarih + saat */
export function dt(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("tr-TR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
