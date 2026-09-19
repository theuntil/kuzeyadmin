/* ══════════════════════════════════════════════════════════════
   GÖRSEL KÜÇÜLTME

   ⚠ TEK YERDE.
   Önce yalnızca `GorselPenceresi` içindeydi; reklam yükleme de
   aynı işi yapması gerekince kopyalamak yerine buraya taşındı.
   İki kopya olsaydı biri güncellenip diğeri unutulurdu.
   ══════════════════════════════════════════════════════════════ */

/**
 * Görseli en fazla 1600 piksele indirir ve JPEG'e çevirir.
 *
 * ⚠ ÇEVİRİLEMEZSE OLDUĞU GİBİ DÖNÜYOR.
 * Tarayıcı bir biçimi çözemezse (nadiren HEIC) küçültme
 * atlanıyor; yükleme yine çalışıyor. Yarım bir dönüşüm
 * göndermektense büyük dosya göndermek iyidir.
 */
export async function gorseliKucult(f: File): Promise<File> {
  const EN_BUYUK = 1600;
  const KALITE = 0.82;

  /* Zaten küçükse dokunma — yeniden kodlamak kaliteyi düşürür */
  if (f.size < 220 * 1024) return f;

  try {
    const bitmap = await createImageBitmap(f);
    const olcek = Math.min(1, EN_BUYUK / Math.max(bitmap.width, bitmap.height));

    if (olcek >= 1 && f.size < 600 * 1024) {
      bitmap.close();
      return f;
    }

    const g = Math.round(bitmap.width * olcek);
    const y = Math.round(bitmap.height * olcek);

    const tuval = document.createElement("canvas");
    tuval.width = g;
    tuval.height = y;

    const ctx = tuval.getContext("2d");
    if (!ctx) { bitmap.close(); return f; }

    ctx.drawImage(bitmap, 0, 0, g, y);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) =>
      tuval.toBlob(res, "image/jpeg", KALITE));

    if (!blob || blob.size >= f.size) return f;   // büyüdüyse orijinali kullan

    return new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return f;
  }
}
