"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Textarea, Select } from "@/components/ui";

/* ══════════════════════════════════════════════════════════════
   AYAR DÜZENLEME PENCERESİ

   ┌─ NEDEN ANINDA KAYDETMİYORUZ ⚠️ ───────────────────────────┐
   │ Ayarlar `onBlur` ile anında kaydediliyordu: yanlışlıkla   │
   │ bir rakama dokunup başka yere tıklamak canlı siteyi       │
   │ değiştiriyordu ve vazgeçme imkânı yoktu.                   │
   └──────────────────────────────────────────────────────────────┘

   ┌─ NEDEN ORTAK `Modal` KULLANILMIYOR ⚠️ ────────────────────┐
   │ O bileşen `bg-page` kullanıyor; koyu temada bu değişken   │
   │ `#000000`. Pencere, arka plan karartmasıyla aynı renge    │
   │ geliyor ve sınırları kaybolup havada duruyordu.            │
   │                                                              │
   │ Burada bir tık açık `--surface` ve belirgin kenarlık var.  │
   │ Mobilde alttan açılan panel (%75 yükseklik) — masaüstü    │
   │ penceresi küçük ekranda sıkışık duruyordu.                 │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export type AyarTuru = "metin" | "sayi" | "uzunmetin" | "secim";

export interface AyarSecenek {
  deger: string | number;
  etiket: string;
}

export default function AyarPenceresi({
  acik, onKapat, onKaydet,
  baslik, aciklama, tur, deger,
  min, max, step, birim, secenekler, ipucu,
}: {
  acik: boolean;
  onKapat: () => void;
  onKaydet: (v: string | number) => Promise<void> | void;
  baslik: string;
  aciklama?: string;
  tur: AyarTuru;
  deger: string | number;
  min?: number;
  max?: number;
  step?: number;
  birim?: string;
  secenekler?: AyarSecenek[];
  ipucu?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [mobil, setMobil] = useState(false);
  const [taslak, setTaslak] = useState<string>(String(deger ?? ""));
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const olc = () => setMobil(!mq.matches);
    olc();
    mq.addEventListener("change", olc);
    return () => mq.removeEventListener("change", olc);
  }, []);

  /*
   * ⚠ `acik` BAĞIMLILIKTA.
   * Bunsuz, pencere kapanıp yeniden açıldığında ilk okunan
   * değer kalıyor ve güncel ayar görünmüyordu.
   */
  useEffect(() => {
    if (!acik) return;
    setTaslak(String(deger ?? ""));
    setHata(null);
  }, [acik, deger]);

  useEffect(() => {
    if (!acik) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onKapat(); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = prev;
    };
  }, [acik, busy, onKapat]);

  if (!mounted || !acik) return null;

  function dogrula(): string | number | null {
    if (tur === "sayi") {
      const n = Number(taslak);
      if (taslak.trim() === "" || Number.isNaN(n)) {
        setHata("Bir sayı gir");
        return null;
      }
      /*
       * ⚠ SINIR KONTROLÜ BURADA DA YAPILIYOR.
       * Tarayıcının `min`/`max` özniteliği yalnızca ok tuşlarını
       * sınırlıyor; elle yazılan değer doğrudan veritabanı
       * kısıtına çarpıp anlaşılmaz hata veriyordu.
       */
      if (typeof min === "number" && n < min) {
        setHata(`En az ${min} olabilir`);
        return null;
      }
      if (typeof max === "number" && n > max) {
        setHata(`En fazla ${max} olabilir`);
        return null;
      }
      return n;
    }
    return taslak;
  }

  async function kaydet() {
    const v = dogrula();
    if (v === null) return;
    setBusy(true);
    try {
      await onKaydet(v);
      onKapat();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  const dugme: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 50, borderRadius: 14, fontSize: 15.5, fontWeight: 700,
    cursor: busy ? "default" : "pointer", border: "none", flex: 1,
  };

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        display: "flex", alignItems: mobil ? "flex-end" : "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={busy ? undefined : onKapat}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        style={{
          position: "relative",
          width: mobil ? "100%" : "min(440px, 92vw)",
          /* Mobilde ekranın %75'i */
          height: mobil ? "75dvh" : undefined,
          maxHeight: mobil ? "75dvh" : "88vh",
          display: "flex", flexDirection: "column",
          /*
           * ⚠ `--page` DEĞİL. Koyu temada o değişken #000000 ve
           * pencere karartmayla aynı renge geliyordu.
           */
          background: "var(--surface)",
          border: "1px solid var(--line2)",
          borderRadius: mobil ? "22px 22px 0 0" : 22,
          boxShadow: "0 24px 70px rgba(0,0,0,.5)",
          animation: mobil
            ? "kb-sheet-in .3s cubic-bezier(.32,.72,0,1) both"
            : "kb-pop-in .22s cubic-bezier(.2,.9,.25,1.05) both",
          overflow: "hidden",
        }}
      >
        {/* Mobilde tutamak */}
        {mobil && (
          <div style={{ display: "grid", placeItems: "center", paddingTop: 10 }}>
            <span style={{
              width: 40, height: 4, borderRadius: 999,
              background: "var(--line2)",
            }} />
          </div>
        )}

        <div style={{ padding: mobil ? "16px 20px 8px" : "22px 24px 8px" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{baslik}</h2>
          {aciklama && (
            <p style={{
              fontSize: 13, lineHeight: 1.6, color: "var(--muted)",
              margin: "8px 0 0",
            }}>
              {aciklama}
            </p>
          )}
        </div>

        <div style={{
          flex: 1, overflowY: "auto",
          padding: mobil ? "10px 20px" : "12px 24px",
        }}>
          {tur === "secim" && secenekler ? (
            <Select
              value={taslak}
              onChange={(e) => { setTaslak(e.target.value); setHata(null); }}
              className="w-full"
              style={{ height: 50, fontSize: 15.5 }}
              autoFocus={!mobil}
            >
              {secenekler.map((o) => (
                <option key={String(o.deger)} value={String(o.deger)}>
                  {o.etiket}
                </option>
              ))}
            </Select>
          ) : tur === "uzunmetin" ? (
            <Textarea
              value={taslak}
              onChange={(e) => { setTaslak(e.target.value); setHata(null); }}
              rows={mobil ? 8 : 7}
              className="w-full"
              style={{ fontSize: 15, lineHeight: 1.6, minHeight: 150 }}
              autoFocus={!mobil}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Input
                type={tur === "sayi" ? "number" : "text"}
                min={min} max={max} step={step ?? 1}
                value={taslak}
                onChange={(e) => { setTaslak(e.target.value); setHata(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") void kaydet(); }}
                className="w-full"
                style={{
                  height: 52, fontSize: 16,
                  textAlign: tur === "sayi" ? "center" : "start",
                }}
                autoFocus={!mobil}
              />
              {birim && (
                <span style={{ flexShrink: 0, fontSize: 14, color: "var(--muted)" }}>
                  {birim}
                </span>
              )}
            </div>
          )}

          {tur === "sayi" && (typeof min === "number" || typeof max === "number") && (
            <p style={{ marginTop: 9, fontSize: 12.5, color: "var(--muted)", textAlign: "center" }}>
              Geçerli aralık: {min ?? "—"} – {max ?? "—"}
            </p>
          )}

          {ipucu && !hata && (
            <p style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
              {ipucu}
            </p>
          )}

          {hata && (
            <p role="alert" style={{
              marginTop: 12, padding: "10px 13px", borderRadius: 11,
              background: "rgba(229,72,77,.12)", color: "#E5484D",
              fontSize: 13, textAlign: "center",
            }}>
              {hata}
            </p>
          )}
        </div>

        {/*
          ⚠ DÜĞMELER EŞİT GENİŞLİKTE VE BÜYÜK.
          Sağa yaslı küçük düğmeler mobilde başparmakla zor
          hedefleniyordu. 50px yükseklik dokunma için rahat.
        */}
        <div style={{
          display: "flex", gap: 10,
          padding: mobil
            ? "12px 20px calc(18px + env(safe-area-inset-bottom))"
            : "14px 24px 22px",
          borderTop: "1px solid var(--line2)",
        }}>
          <button
            type="button"
            onClick={onKapat}
            disabled={busy}
            style={{
              ...dugme,
              background: "var(--chip)", color: "var(--ink)",
              opacity: busy ? .5 : 1,
            }}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void kaydet()}
            disabled={busy}
            style={{
              ...dugme,
              background: "var(--ink)", color: "var(--page)",
              opacity: busy ? .6 : 1,
            }}
          >
            {busy ? "…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
