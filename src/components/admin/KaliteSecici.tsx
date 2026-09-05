"use client";
import Icon, { type IconName } from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   HAZIR KALİTE AYARLARI

   ┌─ NEDEN GEREKLİ ⚠️ ────────────────────────────────────────┐
   │ Kalite bölümünde "CRF", "preset", "ses bit hızı",         │
   │ "işlemci çekirdeği" gibi ffmpeg terimleri vardı. Bunlar   │
   │ doğru ayarlar ama ne işe yaradıklarını bilmeden           │
   │ dokunmak riskli — yanlış bir sayı ya videoyu bozuyor ya   │
   │ sunucuyu kilitliyordu.                                      │
   │                                                              │
   │ Dört hazır seçenek: her biri tüm teknik değerleri birden  │
   │ ayarlıyor. Tek tek ayarlar hâlâ altta duruyor; bilen      │
   │ kullanabilsin diye kaldırılmadı.                            │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

/** Bir hazır ayarın uyguladığı teknik değerler */
export interface KaliteDegerleri {
  video_max_height: number;
  video_crf_short: number;
  video_crf_long: number;
  video_preset: string;
  video_audio_kbps: number;
  video_threads: number;
  video_concurrency: number;
  image_quality: number;
}

export interface KaliteSecenek {
  k: "dusuk" | "orta" | "ortayuksek" | "yuksek";
  ad: string;
  aciklama: string;
  ikon: IconName;
  degerler: KaliteDegerleri;
}

/*
 * ⚠ HER DEĞER VERİTABANI KISITLARININ İÇİNDE.
 *   video_crf_*   18–35     video_threads      1–8
 *   video_max_height ∈ {360,480,720,1080}
 *   image_quality 20–95     video_concurrency  1–4
 * Kısıt dışına çıkan bir hazır ayar, kaydederken anlaşılmaz
 * bir veritabanı hatası verirdi.
 */
export const KALITELER: KaliteSecenek[] = [
  {
    k: "dusuk",
    ad: "Düşük",
    aciklama: "En az yer kaplar, en hızlı işlenir. Görüntü yumuşak olur.",
    ikon: "box",
    degerler: {
      video_max_height: 480, video_crf_short: 30, video_crf_long: 32,
      video_preset: "veryfast", video_audio_kbps: 64,
      video_threads: 2, video_concurrency: 1, image_quality: 55,
    },
  },
  {
    k: "orta",
    ad: "Orta",
    aciklama: "Günlük haber videoları için yeterli. Dengeli seçim.",
    ikon: "check",
    degerler: {
      video_max_height: 720, video_crf_short: 26, video_crf_long: 28,
      video_preset: "fast", video_audio_kbps: 96,
      video_threads: 3, video_concurrency: 2, image_quality: 70,
    },
  },
  {
    k: "ortayuksek",
    ad: "Orta-Yüksek",
    aciklama: "Belirgin daha net. Depolama ve işlem yükü artar.",
    ikon: "star",
    degerler: {
      video_max_height: 720, video_crf_short: 22, video_crf_long: 24,
      video_preset: "medium", video_audio_kbps: 128,
      video_threads: 4, video_concurrency: 2, image_quality: 82,
    },
  },
  {
    k: "yuksek",
    ad: "Yüksek",
    aciklama: "1080p, en net görüntü. Sunucuyu en çok yorar, en çok yer kaplar.",
    ikon: "media",
    degerler: {
      video_max_height: 1080, video_crf_short: 20, video_crf_long: 22,
      video_preset: "medium", video_audio_kbps: 160,
      video_threads: 6, video_concurrency: 2, image_quality: 88,
    },
  },
];

/**
 * Mevcut ayarların hangi hazır seçeneğe uyduğunu bulur.
 *
 * ⚠ TAM EŞLEŞME ARANIYOR.
 * Kullanıcı tek bir değeri elle değiştirmişse artık hiçbir
 * hazır ayara uymuyor demektir; "Özel" gösteriliyor. Yaklaşık
 * eşleştirme yapsaydık, seçili görünen kart aslında farklı
 * değerler uygulardı.
 */
export function kaliteBul(
  s: Partial<KaliteDegerleri>,
): KaliteSecenek["k"] | null {
  for (const q of KALITELER) {
    const uyar = (Object.keys(q.degerler) as (keyof KaliteDegerleri)[])
      .every((alan) => s[alan] === q.degerler[alan]);
    if (uyar) return q.k;
  }
  return null;
}

export default function KaliteSecici({
  secili, onSec, busy,
}: {
  secili: KaliteSecenek["k"] | null;
  onSec: (q: KaliteSecenek) => void;
  busy?: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="mb-1 text-[13.5px] font-bold">Hazır kalite ayarı</div>
      <p className="mb-3 text-[12.5px] leading-relaxed text-muted2">
        Birini seçince aşağıdaki teknik ayarların hepsi birden
        ayarlanır. Tek tek değiştirmek istersen alttaki alanları
        kullanabilirsin.
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {KALITELER.map((q) => {
          const aktif = secili === q.k;
          return (
            <button
              key={q.k}
              type="button"
              disabled={busy}
              onClick={() => onSec(q)}
              aria-pressed={aktif}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-start transition disabled:opacity-50 ${
                aktif
                  ? "border-fg bg-surface2"
                  : "border-line hover:border-muted2"
              }`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${
                aktif ? "bg-fg text-bg" : "bg-surface2 text-muted2"
              }`}>
                <Icon name={q.ikon} size={17} />
              </span>
              <span className="text-[14px] font-bold">{q.ad}</span>
              <span className="text-[11.5px] leading-relaxed text-muted2">
                {q.aciklama}
              </span>
            </button>
          );
        })}
      </div>

      {secili === null && (
        <p className="mt-3 rounded-xl bg-surface2 px-3.5 py-2.5 text-[12.5px] text-muted2">
          Şu an <b className="text-fg">özel</b> ayarlar kullanılıyor —
          değerler hazır seçeneklerin hiçbirine tam uymuyor.
        </p>
      )}
    </div>
  );
}
