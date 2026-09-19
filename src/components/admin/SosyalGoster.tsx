"use client";
import Icon from "@/components/ui/Icon";
import type { Sosyal } from "./SosyalDuzenle";

/**
 * SOSYAL BAĞLANTILAR — GÖRÜNÜM
 *
 * ⚠ DÜZENLEME DEĞİL.
 * Kullanıcı ekranı açılır açılmaz düzenleme kutuları
 * görünüyordu; okumak isteyen biri düzenleme formuyla
 * karşılaşıyordu. Burası yalnızca gösteriyor — düzenleme
 * "Düzenle" penceresinin içinde.
 */

const ADRES: Record<string, (k: string) => string> = {
  website:   (k) => `https://${k}`,
  instagram: (k) => `https://instagram.com/${k}`,
  x:         (k) => `https://x.com/${k}`,
  facebook:  (k) => `https://facebook.com/${k}`,
  youtube:   (k) => `https://youtube.com/@${k}`,
  linkedin:  (k) => `https://linkedin.com/in/${k}`,
  tiktok:    (k) => `https://tiktok.com/@${k}`,
};

const AD: Record<string, string> = {
  website: "Web sitesi", instagram: "Instagram", x: "X",
  facebook: "Facebook", youtube: "YouTube",
  linkedin: "LinkedIn", tiktok: "TikTok",
};

/** Marka simgeleri — ikon paketi eklemeye değmezdi */
export function SosyalSimge({ tur, size = 15 }: { tur: string; size?: number }) {
  const o = { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor" };
  if (tur === "instagram")
    return <svg {...o}><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 5.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 7.4a2.9 2.9 0 1 1 0-5.8 2.9 2.9 0 0 1 0 5.8Zm5.7-7.6a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z"/></svg>;
  if (tur === "facebook")
    return <svg {...o}><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z"/></svg>;
  if (tur === "x")
    return <svg {...o}><path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5 21H1.9l7.3-8.3L2.4 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z"/></svg>;
  if (tur === "youtube")
    return <svg {...o}><path d="M21.6 7.2s-.2-1.4-.8-2c-.7-.8-1.6-.8-2-.9C16 4.1 12 4.1 12 4.1s-4 0-6.8.2c-.4 0-1.3.1-2 .9-.6.6-.8 2-.8 2S2.2 8.8 2.2 10.5v1.6c0 1.6.2 3.3.2 3.3s.2 1.4.8 2c.7.8 1.7.7 2.1.8 1.6.2 6.7.2 6.7.2s4 0 6.8-.2c.4-.1 1.3-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.3v-1.6c0-1.6-.2-3.2-.2-3.2ZM9.9 14.6V8.8l5.2 2.9-5.2 2.9Z"/></svg>;
  if (tur === "linkedin")
    return <svg {...o}><path d="M20.4 3H3.6C2.7 3 2 3.7 2 4.6v14.8c0 .9.7 1.6 1.6 1.6h16.8c.9 0 1.6-.7 1.6-1.6V4.6c0-.9-.7-1.6-1.6-1.6ZM8.1 18.3H5.3V9.7h2.8v8.6ZM6.7 8.5a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Zm12 9.8h-2.8v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3H10V9.7h2.7v1.2h.1c.4-.7 1.3-1.4 2.6-1.4 2.8 0 3.3 1.8 3.3 4.2v4.6Z"/></svg>;
  if (tur === "tiktok")
    return <svg {...o}><path d="M16.6 2h3c.2 1.6 1.1 3 2.4 3.8v3.1c-1.3 0-2.5-.4-3.6-1.1v6.5a6.3 6.3 0 1 1-6.3-6.3c.3 0 .7 0 1 .1v3.2a3.1 3.1 0 1 0 2.2 3V2Z"/></svg>;
  return <svg {...o} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></svg>;
}

export default function SosyalGoster({
  links, onDuzenle,
}: {
  links: Sosyal | null;
  onDuzenle?: () => void;
}) {
  const dolu = Object.entries(links ?? {})
    .filter(([k, v]) => v && ADRES[k]);

  if (dolu.length === 0) {
    return (
      <p className="text-[13px] text-muted2">
        Bağlantı eklenmemiş.
        {onDuzenle && (
          <button type="button" onClick={onDuzenle} className="ms-1.5 underline">
            Ekle
          </button>
        )}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {dolu.map(([tur, kod]) => (
        <li key={tur}>
          <a
            href={ADRES[tur]!(kod as string)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-chip"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chip text-muted">
              <SosyalSimge tur={tur} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] text-muted2">{AD[tur]}</span>
              <span className="block truncate text-[13px] font-medium">
                {tur === "website" ? String(kod) : `@${String(kod)}`}
              </span>
            </span>
            <Icon name="chevronRight" size={14} />
          </a>
        </li>
      ))}
    </ul>
  );
}
