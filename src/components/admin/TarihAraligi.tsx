"use client";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   TARİH ARALIĞI SEÇİCİ

   Hazır aralıklar (7/30/90 gün) yetmediğinde takvimden iki gün
   seçmeye yarıyor.

   ⚠ TARİHLER YEREL, SAAT DİLİMİ KAYMASI YOK.
   `new Date(iso)` UTC olarak yorumlanıyor ve bazı saat
   dilimlerinde bir gün geriye kayıyor. Bu yüzden yıl/ay/gün
   ayrı ayrı işleniyor.
   ══════════════════════════════════════════════════════════════ */

const AY = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const GUN_KISA = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];

/** "2026-09-05" biçiminde, yerel saate göre */
function iso(d: Date): string {
  const a = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${a(d.getMonth() + 1)}-${a(d.getDate())}`;
}

function ayGunleri(yil: number, ay: number): (Date | null)[] {
  const ilk = new Date(yil, ay, 1);
  /*
   * Pazartesi haftanın ilk günü: JS `getDay()` pazarı 0 sayıyor,
   * Türkiye takviminde pazartesi başta.
   */
  const bosluk = (ilk.getDay() + 6) % 7;
  const adet = new Date(yil, ay + 1, 0).getDate();

  return [
    ...Array.from({ length: bosluk }, () => null),
    ...Array.from({ length: adet }, (_, i) => new Date(yil, ay, i + 1)),
  ];
}

export default function TarihAraligi({
  bas, bit, onSec,
}: {
  bas: string;
  bit: string;
  onSec: (bas: string, bit: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [basildi, setBasildi] = useState(false);
  const [secBas, setSecBas] = useState<string | null>(null);
  const [secBit, setSecBit] = useState<string | null>(null);

  const bugun = new Date();
  const [yil, setYil] = useState(bugun.getFullYear());
  const [ay, setAy] = useState(bugun.getMonth());

  /* Kapanış animasyonu görünsün diye DOM'dan gecikmeli sökülüyor */
  useEffect(() => {
    if (acik) { setBasildi(true); return; }
    const z = setTimeout(() => setBasildi(false), 200);
    return () => clearTimeout(z);
  }, [acik]);

  useEffect(() => {
    if (!acik) return;
    setSecBas(bas); setSecBit(bit);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [acik, bas, bit]);

  const gunler = useMemo(() => ayGunleri(yil, ay), [yil, ay]);
  const bugunIso = iso(bugun);

  function tikla(d: Date) {
    const v = iso(d);
    /* İleri tarih seçilemiyor — gelecek için veri yok */
    if (v > bugunIso) return;

    /*
     * ⚠ İKİ TIKLAMALI SEÇİM.
     * İlk tık başlangıcı belirliyor, ikinci tık bitişi. İkinci
     * tık öncekinden erkense sıra kendiliğinden düzeltiliyor —
     * okur ters seçtiğinde hata vermek yerine anlamak doğru.
     */
    if (!secBas || (secBas && secBit)) {
      setSecBas(v); setSecBit(null); return;
    }
    if (v < secBas) { setSecBit(secBas); setSecBas(v); }
    else setSecBit(v);
  }

  const gecerli = Boolean(secBas && secBit);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        title="Tarih aralığı seç"
        aria-label="Tarih aralığı seç"
        className="kb-lift flex h-9 items-center gap-2 rounded-full bg-chip px-3.5 text-[13px] font-semibold text-ink2 transition-colors hover:text-ink"
      >
        <Icon name="clock" size={15} />
        <span className="hidden sm:inline">Tarih aralığı</span>
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
            aria-label="Tarih aralığı"
            className={`kb-takvim fixed z-[200] bg-surface p-5 ${acik ? "kb-acik" : ""}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const y = ay === 0 ? yil - 1 : yil;
                  setYil(y); setAy(ay === 0 ? 11 : ay - 1);
                }}
                aria-label="Önceki ay"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line"
              >
                <Icon name="chevronLeft" size={15} />
              </button>

              <span className="text-[14px] font-bold">{AY[ay]} {yil}</span>

              <button
                type="button"
                onClick={() => {
                  const y = ay === 11 ? yil + 1 : yil;
                  setYil(y); setAy(ay === 11 ? 0 : ay + 1);
                }}
                aria-label="Sonraki ay"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line"
              >
                <Icon name="chevronRight" size={15} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-muted2">
              {GUN_KISA.map((g) => <span key={g}>{g}</span>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {gunler.map((d, i) => {
                if (!d) return <span key={`b${i}`} />;
                const v = iso(d);
                const ileri = v > bugunIso;
                const secili = v === secBas || v === secBit;
                const arada = Boolean(
                  secBas && secBit && v > secBas && v < secBit,
                );
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={ileri}
                    onClick={() => tikla(d)}
                    className={`h-9 rounded-lg text-[13px] transition-colors ${
                      secili ? "bg-solid font-bold text-on-solid"
                      : arada ? "bg-chip"
                      : ileri ? "text-muted2/40"
                      : "hover:bg-chip"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted2">
                {secBas
                  ? secBit ? `${secBas} → ${secBit}` : "Bitiş gününü seçin"
                  : "Başlangıç gününü seçin"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAcik(false)}
                  className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={!gecerli}
                  onClick={() => {
                    if (!gecerli) return;
                    onSec(secBas!, secBit!);
                    setAcik(false);
                  }}
                  className="rounded-lg bg-ink px-4 py-1.5 text-[12.5px] font-bold text-bg disabled:opacity-40"
                >
                  Uygula
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
