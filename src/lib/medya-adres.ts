/**
 * MEDYA ADRESİ
 *
 * ┌─ İKİ FARKLI DÜZEN VAR ⚠️ ─────────────────────────────────┐
 * │ Botun ürettiği medyada `storage_key` bir KLASÖR:            │
 * │   media/2026/08/31/KOD/anahtar/                             │
 * │ Gerçek dosyalar içinde: `card.avif`, `thumb.avif`…          │
 * │                                                              │
 * │ Panelden yüklenen medyada anahtarın kendisi DOSYA:          │
 * │   news/2026/08/31/{id}/abc.jpg                              │
 * │                                                              │
 * │ Video posterinde ise TİRE kullanılıyor, eğik çizgi değil:   │
 * │   {poster_key}-card.avif                                    │
 * │                                                              │
 * │ Üçü aynı sanılınca kapakların TAMAMI 404 veriyordu.         │
 * │ `variants.direct` işareti panel medyasını ayırt ediyor.     │
 * └──────────────────────────────────────────────────────────────┘
 */

export interface KapakBilgi {
  storage_key: string | null;
  poster_key: string | null;
  type: string;
  variants: Record<string, unknown> | null;
  dominant_color?: string | null;
}

export type Varyant = "thumb" | "card" | "full";

/** Bot hangi varyantları üretmiş — olmayanı istemek 404 demek */
function mevcutVaryantlar(v: Record<string, unknown> | null): Varyant[] {
  if (!v) return [];
  const adlar = Object.keys(v).filter((k) =>
    k === "thumb" || k === "card" || k === "full") as Varyant[];
  return adlar;
}

function enUygun(v: Record<string, unknown> | null, istenen: Varyant): Varyant {
  const var_ = mevcutVaryantlar(v);
  if (var_.length === 0) return istenen;
  if (var_.includes(istenen)) return istenen;
  // İstenen yoksa bir küçüğüne düş
  const sira: Varyant[] = ["thumb", "card", "full"];
  for (let i = sira.indexOf(istenen) - 1; i >= 0; i--) {
    if (var_.includes(sira[i]!)) return sira[i]!;
  }
  return var_[0]!;
}

/**
 * Kapak görselinin tam adresi.
 *
 * @param cdn  sondaki eğik çizgi olmadan
 */
export function kapakAdresi(
  k: KapakBilgi | null | undefined,
  cdn: string,
  istenen: Varyant = "card",
): string | null {
  if (!k || !cdn) return null;
  const kok = cdn.replace(/\/+$/, "");

  // Panelden yüklenmiş: anahtarın kendisi dosya
  if (k.variants && "direct" in k.variants) {
    const anahtar = k.type === "video" ? (k.poster_key ?? k.storage_key) : k.storage_key;
    return anahtar ? `${kok}/${anahtar}` : null;
  }

  // Video posteri: TİRE ile
  if (k.type === "video") {
    if (!k.poster_key) return null;
    const v = enUygun(k.variants, istenen);
    const uzanti = posterUzantisi(k.variants);
    return `${kok}/${k.poster_key}-${v}.${uzanti}`;
  }

  // Bot görseli: klasör + varyant dosyası
  if (!k.storage_key) return null;
  const v = enUygun(k.variants, istenen);
  return `${kok}/${k.storage_key}/${v}.avif`;
}

/** Poster gerçek uzantısı — bot jpeg de üretebiliyor */
function posterUzantisi(v: Record<string, unknown> | null): string {
  const p = v?.poster as { ext?: string } | undefined;
  return p?.ext ?? "avif";
}

/** Tek bir medya satırı için — düzenleme ekranında kullanılıyor */
export function medyaOnizleme(
  m: {
    type: string;
    storage_key: string | null;
    poster_key: string | null;
    variants?: Record<string, unknown> | null;
  },
  cdn: string,
): string | null {
  return kapakAdresi(
    {
      storage_key: m.storage_key,
      poster_key: m.poster_key,
      type: m.type,
      variants: m.variants ?? null,
    },
    cdn,
    "card",
  );
}
