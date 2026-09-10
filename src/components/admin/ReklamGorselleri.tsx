"use client";
import { useState } from "react";
import GorselPenceresi from "./GorselPenceresi";

/* ══════════════════════════════════════════════════════════════
   REKLAM SAYFASI GÖRSELLERİ

   ┌─ ÖNCE R2 ANAHTARI ELLE YAZILIYORDU ⚠️ ────────────────────┐
   │ Reklam görselleri metin kutusuna anahtar yazarak           │
   │ ayarlanıyordu. Panelin başka hiçbir yerinde böyle bir      │
   │ şey yok; yöneticinin dosyayı ayrıca yükleyip anahtarını    │
   │ bulup kopyalaması gerekiyordu.                              │
   │                                                              │
   │ Artık diğer görsellerle aynı: tıkla, yükle, gerekirse      │
   │ değiştir ya da kaldır.                                       │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Alan { anahtar: string; etiket: string }

/*
 * ⚠ İLK GÖRSEL ÖZEL.
 * Sayfanın üst bölümünde büyük gösteriliyor; diğer ikisi
 * aşağıdaki şeritte. Etiketler bunu söylüyor ki yönetici
 * hangisini nereye koyduğunu bilsin.
 */
const ALANLAR: Alan[] = [
  { anahtar: "ads_shot_1_key", etiket: "Üst bölüm görseli" },
  { anahtar: "ads_shot_2_key", etiket: "Alt şerit 1" },
  { anahtar: "ads_shot_3_key", etiket: "Alt şerit 2" },
];

export default function ReklamGorselleri({
  degerler, cdnBase, onDegisti,
}: {
  degerler: Record<string, string | null>;
  cdnBase: string;
  onDegisti: (alan: string, deger: string | null) => void;
}) {
  const [pencere, setPencere] = useState<Alan | null>(null);

  const adres = (k: string | null) =>
    k ? `${cdnBase.replace(/\/+$/, "")}/${k}` : null;

  return (
    <div>
      <div className="mb-2 text-[12.5px] font-bold">Ekran görüntüleri</div>
      <p className="mb-3 text-[12px] leading-relaxed text-muted2">
        İlk görsel sayfanın üst bölümünde, başlığın yanında büyük
        gösterilir. Diğer ikisi aşağıdaki şeritte yer alır.
        Boş bırakılan hiç basılmaz.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {ALANLAR.map((a) => {
          const url = adres(degerler[a.anahtar] ?? null);
          return (
            <div key={a.anahtar} className="rounded-xl border border-line p-3">
              <div className="mb-2 text-[12px] font-semibold">{a.etiket}</div>

              <div className="mb-3 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg bg-chip">
                {url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[11.5px] text-muted2">boş</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPencere(a)}
                  className="flex-1 rounded-lg border border-line px-2 py-1.5 text-[12px] font-semibold"
                >
                  {/*
                    ⚠ MEVCUDA GÖRE METİN.
                    "Yükle" ile "Değiştir" aynı düğme olsaydı
                    yönetici görselin var olup olmadığını
                    anlayamazdı.
                  */}
                  {url ? "Değiştir" : "Yükle"}
                </button>

                {url && (
                  <button
                    type="button"
                    onClick={() => onDegisti(a.anahtar, null)}
                    aria-label={`${a.etiket} kaldır`}
                    className="rounded-lg border border-red-500/40 px-2.5 py-1.5 text-[12px] font-semibold text-red-500"
                  >
                    Kaldır
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pencere && (
        <GorselPenceresi
          acik
          onKapat={() => setPencere(null)}
          baslik={`Reklam sayfası — ${pencere.etiket}`}
          aciklama={
            "Reklam alanının göründüğü ekran görüntüsü. Yatay (16:10) "
            + "görseller sayfada en iyi sonucu verir."
          }
          oran="16 / 10"
          cdnBase={cdnBase}
          mevcut={degerler[pencere.anahtar] ?? null}
          onKaydet={(anahtar: string | null) => {
            onDegisti(pencere.anahtar, anahtar);
            setPencere(null);
          }}
        />
      )}
    </div>
  );
}
