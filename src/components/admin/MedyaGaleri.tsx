"use client";
import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/Icon";
import { medyaOnizleme } from "@/lib/medya-adres";

/* ══════════════════════════════════════════════════════════════
   TAM EKRAN MEDYA GALERİSİ

   Medyaya tıklayınca açılıyor. Sağa/sola kaydırarak ya da ok
   tuşlarıyla diğer medyalara geçiliyor.

   ┌─ AÇIKLAMA BURADA GÖRÜNÜYOR ⚠️ ────────────────────────────┐
   │ Izgarada açıklama kırpılıyor. Tam ekranda boş yer bol —    │
   │ tamamı görünüyor.                                            │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface GaleriMedya {
  id: string;
  type: string;
  storage_key: string | null;
  poster_key: string | null;
  caption: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  variants?: Record<string, unknown> | null;
}

export default function MedyaGaleri({
  medya, acikIndex, onKapat, cdn,
}: {
  medya: GaleriMedya[];
  /** null ise galeri kapalı */
  acikIndex: number | null;
  onKapat: () => void;
  cdn: string;
}) {
  const [i, setI] = useState(acikIndex ?? 0);
  const [dokunusX, setDokunusX] = useState<number | null>(null);

  useEffect(() => { if (acikIndex !== null) setI(acikIndex); }, [acikIndex]);

  const ileri = useCallback(() => {
    setI((x) => (x + 1) % medya.length);
  }, [medya.length]);
  const geri = useCallback(() => {
    setI((x) => (x - 1 + medya.length) % medya.length);
  }, [medya.length]);

  /* Klavye: ok tuşları ve Esc */
  useEffect(() => {
    if (acikIndex === null) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKapat();
      else if (e.key === "ArrowRight") ileri();
      else if (e.key === "ArrowLeft") geri();
    };
    window.addEventListener("keydown", tus);
    /* Arka plan kaymasın */
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tus);
      document.body.style.overflow = eski;
    };
  }, [acikIndex, ileri, geri, onKapat]);

  if (acikIndex === null || medya.length === 0) return null;

  const m = medya[i];
  if (!m) return null;

  const gorsel = medyaOnizleme(m, cdn);
  const video = m.type === "video";
  const videoAdres = video && m.storage_key
    ? (m.variants && "direct" in m.variants
        ? `${cdn.replace(/\/+$/, "")}/${m.storage_key}`
        : `${cdn.replace(/\/+$/, "")}/${m.storage_key}/video.mp4`)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Medya önizleme"
      onClick={onKapat}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        background: "rgba(0,0,0,.94)",
        // iOS'ta adres çubuğu yüzünden 100vh taşıyor
        height: "100dvh",
      }}
    >
      {/* Üst çubuk */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", color: "#fff", flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13.5, opacity: 0.75 }}>
          {i + 1} / {medya.length}
        </span>
        <button
          type="button"
          onClick={onKapat}
          aria-label="Kapat"
          style={{
            marginInlineStart: "auto",
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, borderRadius: 999, border: "none",
            background: "rgba(255,255,255,.12)", color: "#fff", cursor: "pointer",
          }}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Medya alanı */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setDokunusX(e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          /*
           * Kaydırma: 50 px eşiği. Daha azı kazara dokunuş
           * sayılıyor ve resim titriyordu.
           */
          if (dokunusX === null) return;
          const fark = (e.changedTouches[0]?.clientX ?? 0) - dokunusX;
          if (Math.abs(fark) > 50) { if (fark < 0) ileri(); else geri(); }
          setDokunusX(null);
        }}
        style={{
          position: "relative", flex: 1, minHeight: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 8px",
        }}
      >
        {videoAdres ? (
          <video
            src={videoAdres}
            poster={gorsel ?? undefined}
            controls
            playsInline
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }}
          />
        ) : gorsel ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={gorsel}
            alt={m.caption ?? ""}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10 }}
          />
        ) : (
          <span style={{ color: "rgba(255,255,255,.5)" }}>Önizleme yok</span>
        )}

        {/* Oklar — tek medyada gizli */}
        {medya.length > 1 && (
          <>
            {([["geri", geri, "chevronLeft", "start"],
               ["ileri", ileri, "chevronRight", "end"]] as const).map(([ad, fn, ikon, yan]) => (
              <button
                key={ad}
                type="button"
                onClick={fn}
                aria-label={ad === "geri" ? "Önceki" : "Sonraki"}
                style={{
                  position: "absolute", top: "50%", transform: "translateY(-50%)",
                  [yan === "start" ? "insetInlineStart" : "insetInlineEnd"]: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 42, height: 42, borderRadius: 999, border: "none",
                  background: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer",
                }}
              >
                <Icon name={ikon} size={20} />
              </button>
            ))}
          </>
        )}
      </div>

      {/* Açıklama — tam ekranda tamamı görünüyor */}
      {(m.caption || m.credit || m.width) && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            flexShrink: 0, padding: "14px 18px 20px",
            color: "#fff", textAlign: "center",
          }}
        >
          {m.caption && (
            <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0, maxWidth: "68ch", marginInline: "auto" }}>
              {m.caption}
            </p>
          )}
          <p style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>
            {m.credit ? `${m.credit} · ` : ""}
            {m.width && m.height ? `${m.width}×${m.height}` : ""}
            {m.duration_sec ? ` · ${Math.round(m.duration_sec)} sn` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
