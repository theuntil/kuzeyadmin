"use client";
import { useState } from "react";
import GorselPenceresi from "./GorselPenceresi";

/* ══════════════════════════════════════════════════════════════
   YÖNETİCİ GÖRSELLERİ

   Fotoğraf ve kapak. İkisi de pencerede önizlenip
   `Kaydet` ile uygulanıyor — dosya seçer seçmez canlıya
   yansımıyor.
   ══════════════════════════════════════════════════════════════ */

export default function YoneticiGorselleri({
  foto, kapak, cdnBase, onDegisti,
}: {
  foto: string | null;
  kapak: string | null;
  cdnBase: string;
  onDegisti: (alan: string, deger: string | null) => void;
}) {
  const [pencere, setPencere] = useState<
    { alan: string; baslik: string; aciklama: string; oran: string } | null
  >(null);

  const url = (k: string | null) =>
    k ? `${cdnBase.replace(/\/+$/, "")}/${k}` : null;

  const kutular = [
    {
      alan: "yonetici_foto_key", ad: "Fotoğraf",
      mevcut: foto, oran: "1 / 1", en: 92,
      aciklama: "Kare fotoğraf. Kartta ve sayfada daire olarak kırpılır.",
    },
    {
      alan: "yonetici_kapak_key", ad: "Kapak",
      mevcut: kapak, oran: "3 / 1", en: 190,
      aciklama: "Geniş kapak görseli. Boş bırakırsan sayfada kapak çıkmaz.",
    },
  ];

  return (
    <div className="mt-4">
      {pencere && (
        <GorselPenceresi
          acik
          onKapat={() => setPencere(null)}
          baslik={pencere.baslik}
          aciklama={pencere.aciklama}
          oran={pencere.oran}
          cdnBase={cdnBase}
          mevcut={pencere.alan === "yonetici_foto_key" ? foto : kapak}
          onKaydet={(anahtar: string | null) => { onDegisti(pencere.alan, anahtar); }}
        />
      )}

      <div className="flex flex-wrap items-start gap-5">
        {kutular.map((k) => {
          const g = url(k.mevcut);
          return (
            <div key={k.alan}>
              <div className="mb-2 text-[12.5px] font-bold">{k.ad}</div>
              <div
                className="grid place-items-center overflow-hidden rounded-xl border border-line bg-surface2"
                style={{ width: k.en, aspectRatio: k.oran }}
              >
                {g ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={g} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[11px] text-muted2">yok</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPencere({
                  alan: k.alan, baslik: k.ad,
                  aciklama: k.aciklama, oran: k.oran,
                })}
                className="mt-2 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold"
              >
                {k.mevcut ? "Değiştir" : "Görsel seç"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
