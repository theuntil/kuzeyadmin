"use client";
import { useEffect, useState } from "react";
import FiltrePanel from "./FiltrePanel";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   SAKINCALI İÇERİK FİLTRESİ — PENCERE

   ⚠ KAPANIŞ ANİMASYONU İÇİN GECİKME.
   Pencere doğrudan kaldırılırsa DOM'dan anında silinir ve
   kapanma hiç görünmez. `basildi` animasyon süresi kadar
   bekletiyor.
   ══════════════════════════════════════════════════════════════ */

export default function FiltrePencere() {
  const [acik, setAcik] = useState(false);
  const [basildi, setBasildi] = useState(false);

  useEffect(() => {
    if (acik) { setBasildi(true); return; }
    const z = setTimeout(() => setBasildi(false), 220);
    return () => clearTimeout(z);
  }, [acik]);

  useEffect(() => {
    if (!acik) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", esc);
    /* Arkadaki liste kaymasın */
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = eski;
    };
  }, [acik]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="mb-4 flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-[13px] font-bold"
      >
        <Icon name="settings" size={15} />
        Sakıncalı içerik filtresi
      </button>

      {basildi && (
        <>
          <div
            onClick={() => setAcik(false)}
            aria-hidden
            className={`fixed inset-0 z-[190] bg-black/50 transition-opacity duration-200 ${
              acik ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sakıncalı içerik filtresi"
            className={`kb-filtre-pencere fixed z-[200] overflow-y-auto bg-surface p-6 ${
              acik ? "kb-acik" : ""
            }`}
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-extrabold">Sakıncalı içerik filtresi</h2>
              <button
                type="button"
                onClick={() => setAcik(false)}
                aria-label="Kapat"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line"
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            <FiltrePanel />
          </div>
        </>
      )}
    </>
  );
}
