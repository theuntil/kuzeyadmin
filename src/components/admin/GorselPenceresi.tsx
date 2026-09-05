"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui";
import { r2Yukle, type Onek } from "@/lib/upload";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   GÖRSEL DÜZENLEME PENCERESİ

   ┌─ NEDEN PENCERE ⚠️ ────────────────────────────────────────┐
   │ Görsel seçilir seçilmez yükleniyor ve KAYDEDİLİYORDU.     │
   │ Yanlış dosya seçmek canlı siteyi anında değiştiriyordu;   │
   │ geri almak için eski dosyayı bulup tekrar yüklemek        │
   │ gerekiyordu.                                                │
   │                                                              │
   │ Artık: pencere açılıyor → mevcut görsel görünüyor →       │
   │ değiştir/kaldır → önizleme → `Kaydet`. Vazgeçilirse       │
   │ hiçbir şey değişmiyor.                                      │
   │                                                              │
   │ ⚠ YÜKLEME `Kaydet`E KADAR BEKLEMİYOR — dosya R2'ye hemen  │
   │ gidiyor ki önizleme gerçek olsun. Ama AYAR kaydedilmiyor;  │
   │ vazgeçilirse yüklenen dosya sahipsiz kalıyor, o kadar.     │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export default function GorselPenceresi({
  acik, onKapat, onKaydet,
  baslik, aciklama, mevcut, cdnBase, klasor = "library",
  oran = "16 / 9",
}: {
  acik: boolean;
  onKapat: () => void;
  /** null gönderilirse görsel kaldırılıyor */
  onKaydet: (anahtar: string | null) => Promise<void> | void;
  baslik: string;
  aciklama?: string;
  mevcut: string | null;
  cdnBase: string;
  klasor?: Onek;
  /** Önizleme kutusunun en-boy oranı */
  oran?: string;
}) {
  const [anahtar, setAnahtar] = useState<string | null>(mevcut);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!acik) return;
    setAnahtar(mevcut);
    setHata(null);
  }, [acik, mevcut]);

  const url = (k: string | null) =>
    k ? `${cdnBase.replace(/\/+$/, "")}/${k}` : null;

  async function dosyaSec(f: File) {
    if (!f.type.startsWith("image/")) {
      setHata("Yalnızca görsel yükleyebilirsin");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setHata("Dosya 5 MB'den büyük olamaz");
      return;
    }

    setYukleniyor(true);
    setHata(null);
    try {
      const { key } = await r2Yukle(f, klasor, f.name);
      setAnahtar(key);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setYukleniyor(false);
    }
  }

  async function kaydet() {
    setBusy(true);
    try {
      await onKaydet(anahtar);
      onKapat();
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  }

  const onizleme = url(anahtar);
  const degisti = anahtar !== mevcut;

  return (
    <Modal
      open={acik}
      onClose={busy || yukleniyor ? () => {} : onKapat}
      title={baslik}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onKapat} disabled={busy || yukleniyor}>
            Vazgeç
          </Button>
          <Button
            onClick={() => void kaydet()}
            disabled={busy || yukleniyor || !degisti}
            title={degisti ? undefined : "Değişiklik yok"}
          >
            {busy ? "…" : "Kaydet"}
          </Button>
        </div>
      }
    >
      {aciklama && (
        <p className="mb-4 text-[13px] leading-relaxed text-muted2">
          {aciklama}
        </p>
      )}

      {/* ---- önizleme ---- */}
      <div
        className="mb-4 grid w-full place-items-center overflow-hidden rounded-2xl border border-line bg-surface2"
        style={{ aspectRatio: oran }}
      >
        {yukleniyor ? (
          <span className="text-[13px] text-muted2">Yükleniyor…</span>
        ) : onizleme ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={onizleme}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted2">
            <Icon name="media" size={26} />
            <span className="text-[13px]">Görsel yok</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => girdi.current?.click()}
          disabled={yukleniyor || busy}
        >
          {anahtar ? "Değiştir" : "Görsel seç"}
        </Button>

        {anahtar && (
          <Button
            variant="ghost"
            onClick={() => { setAnahtar(null); setHata(null); }}
            disabled={yukleniyor || busy}
          >
            Kaldır
          </Button>
        )}
      </div>

      <input
        ref={girdi}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void dosyaSec(f);
          e.target.value = "";
        }}
      />

      {degisti && !hata && (
        <p className="mt-3 text-[12px] text-muted2">
          {anahtar ? "Yeni görsel seçildi." : "Görsel kaldırılacak."} Kaydet&apos;e
          basmadan değişiklik uygulanmaz.
        </p>
      )}

      {hata && (
        <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
          {hata}
        </p>
      )}
    </Modal>
  );
}
