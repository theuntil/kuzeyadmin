"use client";
import { useState } from "react";

/* ══════════════════════════════════════════════════════════════
   SOSYAL MEDYA ALANLARI

   ⚠ BOŞ ALAN KAYDEDİLMİYOR.
   Boş bırakılan bağlantı `null` olarak gidiyor; boş dize
   kaydedilseydi yazar sayfasında tıklanamayan bir bağlantı
   belirirdi.
   ══════════════════════════════════════════════════════════════ */

const ALANLAR = [
  { k: "website", ad: "Web sitesi", ipucu: "https://..." },
  { k: "x", ad: "X", ipucu: "https://x.com/..." },
  { k: "instagram", ad: "Instagram", ipucu: "https://instagram.com/..." },
  { k: "linkedin", ad: "LinkedIn", ipucu: "https://linkedin.com/in/..." },
] as const;

export default function SosyalAlanlar({
  links, onKaydet,
}: {
  links: Record<string, string> | null;
  onKaydet: (yeni: Record<string, string | null>) => Promise<boolean>;
}) {
  const [taslak, setTaslak] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {};
    for (const a of ALANLAR) b[a.k] = links?.[a.k] ?? "";
    return b;
  });
  const [kaydediyor, setKaydediyor] = useState(false);

  const degisti = ALANLAR.some(
    (a) => (taslak[a.k] || "") !== (links?.[a.k] ?? ""),
  );

  /* Geçersiz adres varsa kaydetme kapalı: kırık bağlantı olmasın */
  const gecersiz = ALANLAR.some(
    (a) => taslak[a.k].trim() && !/^https?:\/\//i.test(taslak[a.k].trim()),
  );

  async function kaydet() {
    if (!degisti || gecersiz || kaydediyor) return;
    setKaydediyor(true);

    const yeni: Record<string, string | null> = {};
    for (const a of ALANLAR) {
      yeni[a.k] = taslak[a.k].trim() || null;
    }

    const ok = await onKaydet(yeni);
    setKaydediyor(false);
    if (!ok) return;
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ALANLAR.map((a) => {
          const deger = taslak[a.k];
          const hatali = Boolean(deger.trim())
            && !/^https?:\/\//i.test(deger.trim());
          return (
            <div key={a.k}>
              <label className="mb-1.5 block text-[12.5px] font-semibold">
                {a.ad}
              </label>
              <input
                value={deger}
                onChange={(e) =>
                  setTaslak((p) => ({ ...p, [a.k]: e.target.value }))}
                placeholder={a.ipucu}
                inputMode="url"
                className={`w-full rounded-lg border bg-transparent px-3 py-2.5 text-[13.5px] ${
                  hatali ? "border-red-500/60" : "border-line"
                }`}
              />
              {hatali && (
                <p className="mt-1 text-[11.5px] text-red-500">
                  https:// ile başlamalı
                </p>
              )}
            </div>
          );
        })}
      </div>

      {degisti && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void kaydet()}
            disabled={gecersiz || kaydediyor}
            className="rounded-lg bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-40"
          >
            {kaydediyor ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
