"use client";

/* ══════════════════════════════════════════════════════════════
   UYGULAMA İSTATİSTİK ŞERİDİ

   App Store'daki gibi en fazla dört sütun. Her sütun üç satır:
   üstte küçük etiket, ortada büyük değer, altta açıklama.

   Örnek: "2 PUAN" / "5,0" / "★★★★★"
   ══════════════════════════════════════════════════════════════ */

type Satir = { ust: string; orta: string; alt: string };

const ORNEKLER: Satir[] = [
  { ust: "2 PUAN",    orta: "5,0",      alt: "★★★★★" },
  { ust: "YAŞ SINIRI", orta: "9+",      alt: "Uygulama İçi Kontrol" },
  { ust: "KATEGORİ",  orta: "Haberler", alt: "Haber" },
  { ust: "GELİŞTİRİCİ", orta: "KB",     alt: "Kuzeybatı" },
];

export default function IstatistikSeridi({
  satirlar, onDegisti,
}: {
  satirlar: Satir[];
  onDegisti: (v: Satir[]) => void;
}) {
  function guncelle(i: number, alan: keyof Satir, deger: string) {
    const d = satirlar.map((s, j) => (j === i ? { ...s, [alan]: deger } : s));
    onDegisti(d);
  }

  function ekle() {
    if (satirlar.length >= 4) return;
    onDegisti([...satirlar, ORNEKLER[satirlar.length] ?? { ust: "", orta: "", alt: "" }]);
  }

  function sil(i: number) {
    onDegisti(satirlar.filter((_, j) => j !== i));
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-bold">
          İstatistik şeridi {satirlar.length > 0 && `(${satirlar.length}/4)`}
        </span>
        <button
          type="button"
          onClick={ekle}
          disabled={satirlar.length >= 4}
          className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
        >
          Sütun ekle
        </button>
      </div>

      <p className="mb-3 text-[11.5px] leading-relaxed text-muted2">
        Tanıtım kartında uygulama adının altında görünür.
        App Store&apos;daki puan / yaş sınırı / kategori şeridinin aynısı.
        Boş bırakırsan şerit hiç çıkmaz.
      </p>

      {satirlar.length === 0 ? (
        <p className="text-[11.5px] text-muted2">Henüz sütun yok.</p>
      ) : (
        <div className="grid gap-2">
          {satirlar.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="w-[110px] shrink-0"
                placeholder="Etiket"
                value={s.ust}
                onChange={(e) => guncelle(i, "ust", e.target.value)}
              />
              <input
                className="w-[100px] shrink-0"
                placeholder="Değer"
                value={s.orta}
                onChange={(e) => guncelle(i, "orta", e.target.value)}
              />
              <input
                className="min-w-0 flex-1"
                placeholder="Açıklama"
                value={s.alt}
                onChange={(e) => guncelle(i, "alt", e.target.value)}
              />
              <button
                type="button"
                onClick={() => sil(i)}
                className="shrink-0 rounded border border-line px-2 py-1 text-[11.5px] text-danger"
                aria-label="Sütunu sil"
              >
                sil
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
