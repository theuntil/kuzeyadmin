"use client";
import { useState } from "react";
import CategoriesPanel from "@/components/admin/CategoriesPanel";
import MappingPanel, { type Secenek } from "@/components/admin/MappingPanel";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   KATEGORİLER — TEK SAYFA

   ┌─ İKİ AYRI MENÜ ÖĞESİ KAFA KARIŞTIRIYORDU ⚠️ ──────────────┐
   │ "Kategoriler" ve "Kategori ve şehir eşleştirme" ayrı        │
   │ sayfalardı. İkisinin ne yaptığı menüden anlaşılmıyordu.     │
   │                                                              │
   │ Artık tek sayfa:                                             │
   │   Kategoriler → kategoriyi OLUŞTURUR                        │
   │   Eşleştirme  → gelen haberi o kategoriye BAĞLAR            │
   │                                                              │
   │ İkinci sekme dişli ikonuyla açılıyor: günlük iş kategori    │
   │ düzenlemek, eşleştirme ayda bir yapılan bir ayar.           │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function TaksonomiPanel({
  catOptions, cityOptions, bekleyen,
}: {
  catOptions: Secenek[];
  cityOptions: Secenek[];
  /** Bağlanmamış ham ad sayısı — sekmedeki rozet */
  bekleyen: number;
}) {
  const [sekme, setSekme] = useState<"liste" | "eslestirme">("liste");

  return (
    <div className="flex flex-col gap-5">
      {/* ── Sekmeler ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSekme("liste")}
          className={`rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors ${
            sekme === "liste"
              ? "bg-solid text-on-solid"
              : "bg-chip text-ink2 hover:text-ink"
          }`}
        >
          Kategoriler
        </button>

        <button
          type="button"
          onClick={() => setSekme("eslestirme")}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors ${
            sekme === "eslestirme"
              ? "bg-solid text-on-solid"
              : "bg-chip text-ink2 hover:text-ink"
          }`}
        >
          <Icon name="settings" size={15} />
          Eşleştirme
          {/* Bekleyen varsa rozet: dikkat çekmesi gereken tek durum */}
          {bekleyen > 0 && (
            <span className={`kb-num rounded-full px-2 py-0.5 text-[11.5px] font-bold ${
              sekme === "eslestirme" ? "bg-white/20" : "bg-orange-soft text-orange-ink"
            }`}>
              {bekleyen}
            </span>
          )}
        </button>
      </div>

      {/* ── Açıklama ── */}
      <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-muted">
        {sekme === "liste"
          ? "Sitedeki kategoriler. Buradan yeni kategori açar, adını ve rengini değiştirir, menüde görünüp görünmeyeceğini belirlersin."
          : "Ajanstan gelen haberlerin üzerinde düz metin yazar (\u201CASAYİŞ\u201D gibi). Bir kez bağladığında o metinle gelen her haber otomatik doğru kategoriye düşer."}
      </p>

      {sekme === "liste" ? (
        <CategoriesPanel />
      ) : (
        <MappingPanel catOptions={catOptions} cityOptions={cityOptions} />
      )}
    </div>
  );
}
