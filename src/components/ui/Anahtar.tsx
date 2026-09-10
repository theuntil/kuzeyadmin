"use client";

/* ══════════════════════════════════════════════════════════════
   AÇMA/KAPAMA ANAHTARI

   ⚠ KAPALIYKEN REKLAMLAR SİLİNMİYOR.
   Yalnızca gösterilmiyor. Açınca hepsi geri geliyor.
   ══════════════════════════════════════════════════════════════ */

export function Anahtar({
  acik, onDegis,
}: { acik: boolean; onDegis: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      onClick={() => onDegis(!acik)}
      className={`flex h-7 w-[46px] shrink-0 items-center rounded-full p-0.5 transition-colors ${
        acik ? "bg-emerald-500" : "bg-chip"
      }`}
    >
      <span
        className={`h-6 w-6 rounded-full bg-surface shadow-sm transition-transform ${
          acik ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}
