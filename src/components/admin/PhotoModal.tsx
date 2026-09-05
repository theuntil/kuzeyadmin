"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   FOTOĞRAF POPUP'I

   ┌─ DOSYA SEÇİCİ DOĞRUDAN AÇILMIYOR ⚠️ ───────────────────────┐
   │ Fotoğrafa basınca hemen dosya seçici açılıyordu. Mevcut     │
   │ fotoğrafı büyük görmek ya da sadece kaldırmak isteyen       │
   │ kullanıcı da dosya seçiciyle karşılaşıyordu.                 │
   │                                                              │
   │ Artık popup açılıyor: fotoğraf varsa büyük gösterilir,      │
   │ altında "Değiştir" ve "Kaldır" durur. Yoksa "Fotoğraf seç". │
   └──────────────────────────────────────────────────────────────┘

   ┌─ KIRPMA TARAYICIDA ⚠️ ────────────────────────────────────┐
   │ Sunucuya 8 MB'lık ham fotoğraf gönderip orada işlemek      │
   │ yerine canvas'ta kırpılıp yeniden boyutlandırılıyor.       │
   │ Yüklenen dosya ~150 KB'a iniyor; R2 maliyeti ve yükleme    │
   │ süresi düşüyor.                                             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

type Oran = "kare" | "kapak";

/** Çıktı boyutları — kaynak büyük olsa da bu ölçüye indirilir */
const OLCU: Record<Oran, { w: number; h: number }> = {
  kare: { w: 512, h: 512 },
  kapak: { w: 1600, h: 500 },
};

export default function PhotoModal({
  open, onClose, baslik, oran, mevcut, onSecildi, onKaldir, kaydediyor,
}: {
  open: boolean;
  onClose: () => void;
  baslik: string;
  oran: Oran;
  mevcut: string | null;
  /** Kırpılmış görsel; yükleme çağıranın işi */
  onSecildi: (blob: Blob) => void | Promise<void>;
  onKaldir: () => void | Promise<void>;
  kaydediyor: boolean;
}) {
  const [kaynak, setKaynak] = useState<string | null>(null);
  const [olcek, setOlcek] = useState(1);
  const [kaydir, setKaydir] = useState({ x: 0, y: 0 });
  const [surukluyor, setSurukluyor] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const kutuRef = useRef<HTMLDivElement | null>(null);
  const baslangic = useRef({ x: 0, y: 0, kx: 0, ky: 0 });

  const en = oran === "kare" ? 1 : 3.2;

  /* Popup kapanınca durumu sıfırla — ikinci açılışta eski
     fotoğraf ve konum kalmasın */
  useEffect(() => {
    if (!open) {
      setKaynak(null); setOlcek(1); setKaydir({ x: 0, y: 0 });
    }
  }, [open]);

  useEffect(() => {
    return () => { if (kaynak) URL.revokeObjectURL(kaynak); };
  }, [kaynak]);

  function dosyaSecildi(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return;
    if (kaynak) URL.revokeObjectURL(kaynak);
    setKaynak(URL.createObjectURL(f));
    setOlcek(1);
    setKaydir({ x: 0, y: 0 });
  }

  /* ---- Sürükleyerek konumlandırma ---- */
  const bastir = useCallback((cx: number, cy: number) => {
    setSurukluyor(true);
    baslangic.current = { x: cx, y: cy, kx: kaydir.x, ky: kaydir.y };
  }, [kaydir]);

  const tasi = useCallback((cx: number, cy: number) => {
    if (!surukluyor) return;
    setKaydir({
      x: baslangic.current.kx + (cx - baslangic.current.x),
      y: baslangic.current.ky + (cy - baslangic.current.y),
    });
  }, [surukluyor]);

  useEffect(() => {
    if (!surukluyor) return;
    const birak = () => setSurukluyor(false);
    const hareket = (e: MouseEvent) => tasi(e.clientX, e.clientY);
    window.addEventListener("mousemove", hareket);
    window.addEventListener("mouseup", birak);
    return () => {
      window.removeEventListener("mousemove", hareket);
      window.removeEventListener("mouseup", birak);
    };
  }, [surukluyor, tasi]);

  /* ---- Kırp ve üret ---- */
  async function kirpVeKaydet() {
    const img = imgRef.current;
    const kutu = kutuRef.current;
    if (!img || !kutu) return;

    const { w: hedefW, h: hedefH } = OLCU[oran];
    const c = document.createElement("canvas");
    c.width = hedefW; c.height = hedefH;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    /*
     * Ekrandaki yerleşimi canvas'a birebir aktar.
     *
     * Görsel `object-contain` ile kutuya sığdırılıp `scale` ve
     * `translate` uygulanıyor. Aynı dönüşümü canvas ölçeğiyle
     * çarparak uyguluyoruz — WYSIWYG.
     */
    const kutuW = kutu.clientWidth;
    const kutuH = kutu.clientHeight;
    const k = hedefW / kutuW;   // canvas / ekran oranı

    const dogalOran = img.naturalWidth / img.naturalHeight;
    const kutuOran = kutuW / kutuH;
    let temelW: number, temelH: number;
    if (dogalOran > kutuOran) { temelH = kutuH; temelW = kutuH * dogalOran; }
    else { temelW = kutuW; temelH = kutuW / dogalOran; }

    const cizW = temelW * olcek * k;
    const cizH = temelH * olcek * k;
    const cizX = (hedefW - cizW) / 2 + kaydir.x * k;
    const cizY = (hedefH - cizH) / 2 + kaydir.y * k;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, hedefW, hedefH);
    ctx.drawImage(img, cizX, cizY, cizW, cizH);

    const blob = await new Promise<Blob | null>((r) =>
      c.toBlob(r, "image/jpeg", 0.88),
    );
    if (blob) await onSecildi(blob);
  }

  return (
    <Modal open={open} onClose={onClose} title={baslik}>
      <div className="flex flex-col gap-4">
        {kaynak ? (
          <>
            {/* ── Kırpma alanı ── */}
            <div
              ref={kutuRef}
              onMouseDown={(e) => { e.preventDefault(); bastir(e.clientX, e.clientY); }}
              onTouchStart={(e) => bastir(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => tasi(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchEnd={() => setSurukluyor(false)}
              className={`relative w-full overflow-hidden bg-black ${
                oran === "kare" ? "rounded-full" : "rounded-[16px]"
              } ${surukluyor ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ aspectRatio: String(en) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={kaynak}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                style={{
                  transform: `translate(${kaydir.x}px, ${kaydir.y}px) scale(${olcek})`,
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <Icon name="search" size={15} />
              <input
                type="range" min={1} max={3} step={0.02} value={olcek}
                onChange={(e) => setOlcek(Number(e.target.value))}
                aria-label="Yakınlaştır"
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-chip accent-[var(--solid)]"
              />
              <span className="kb-num w-12 text-end text-[12.5px] text-muted">
                {olcek.toFixed(1)}×
              </span>
            </div>

            <p className="text-[12.5px] text-muted2">
              Görseli sürükleyerek konumlandır, kaydırıcıyla yakınlaştır.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={kirpVeKaydet} loading={kaydediyor}>
                <Icon name="check" size={16} /> Kaydet
              </Button>
              <Button variant="ghost" onClick={() => setKaynak(null)} disabled={kaydediyor}>
                Başka görsel
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* ── Mevcut fotoğraf ── */}
            <div
              className={`mx-auto overflow-hidden bg-chip ${
                oran === "kare" ? "h-40 w-40 rounded-full" : "h-32 w-full rounded-[16px]"
              }`}
            >
              {mevcut ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mevcut} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted2">
                  <Icon name="camera" size={28} />
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={kaydediyor}>
                <Icon name="camera" size={16} />
                {mevcut ? "Değiştir" : "Fotoğraf seç"}
              </Button>
              {mevcut && (
                <Button variant="ghost" onClick={onKaldir} loading={kaydediyor}>
                  <Icon name="trash" size={16} /> Kaldır
                </Button>
              )}
            </div>

            <p className="text-center text-[12.5px] text-muted2">
              {oran === "kare"
                ? "Kare kırpılır, 512×512 olarak kaydedilir."
                : "Geniş kırpılır, 1600×500 olarak kaydedilir."}
            </p>
          </>
        )}

        <input
          ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { dosyaSecildi(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
    </Modal>
  );
}
