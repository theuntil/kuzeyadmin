import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * CLOUDFLARE R2 — İMZALI YÜKLEME
 *
 * ┌─ DOSYA SUNUCUDAN GEÇMEZ ⚠️ ────────────────────────────────┐
 * │ Tarayıcı dosyayı DOĞRUDAN R2'ye yükler. Next.js yalnızca    │
 * │ kısa ömürlü bir imzalı adres üretir.                        │
 * │                                                              │
 * │ Neden: 10 MB'lık bir görseli önce sunucuya, oradan R2'ye     │
 * │ göndermek iki kat bant genişliği ve sunucuda bellek demek.   │
 * │ Vercel/Dokploy'da istek gövdesi sınırı da var.               │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ┌─ R2 ANAHTARLARI TARAYICIYA GİTMEZ ⚠️ ──────────────────────┐
 * │ `S3_ACCESS_KEY_ID` ve `S3_SECRET_ACCESS_KEY` yalnızca        │
 * │ sunucuda. `NEXT_PUBLIC_` öneki ASLA verilmemeli — verilirse  │
 * │ imaja gömülür ve herkes bucket'a yazabilir.                  │
 * └──────────────────────────────────────────────────────────────┘
 */

const ONEKLER = ["avatar", "library", "editor", "mail", "haber"] as const;
export type Onek = (typeof ONEKLER)[number];

/** Kabul edilen türler ve uzantıları */
const TURLER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  /* Mail ekleri: ofis ve arşiv dosyaları da geçer */
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
};

/** Önek başına en büyük dosya. Video yalnızca `editor` altında. */
const SINIR: Record<Onek, number> = {
  /* Haber medyası: video da olabiliyor, kitaplıkla aynı sınır */
  haber: 200 * 1024 * 1024,
  avatar: 5 * 1024 * 1024,
  library: 10 * 1024 * 1024,
  editor: 100 * 1024 * 1024,
  /* Mail eki: sağlayıcıların çoğu 25 MB'ı reddediyor, 20'de kal */
  mail: 20 * 1024 * 1024,
};

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;

  const endpoint = process.env.S3_ENDPOINT;
  const key = process.env.S3_ACCESS_KEY_ID;
  const secret = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !key || !secret) {
    throw new Error(
      "R2 ayarları eksik. S3_ENDPOINT, S3_ACCESS_KEY_ID ve " +
      "S3_SECRET_ACCESS_KEY tanımlı olmalı.",
    );
  }

  client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    // R2 path-style ister; virtual-host stili 404 döner
    forcePathStyle: true,
  });
  return client;
}

function bucket(): string {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET tanımlı değil");
  return b;
}

export interface YuklemeIstegi {
  onek: Onek;
  contentType: string;
  bytes: number;
  /** avatar ve editor için zorunlu: dosya kullanıcının klasörüne gider */
  userId?: string;
  /** Özgün ad — yalnızca uzantı ve okunabilirlik için */
  fileName?: string;
}

export interface YuklemeYaniti {
  url: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

/** Dosya adını anahtara girecek hâle getirir */
function temizAd(ad: string | undefined, uzanti: string): string {
  const taban = (ad ?? "dosya")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // aksanları at
    .replace(/\.[^.]+$/, "")                            // uzantıyı at
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${taban || "dosya"}.${uzanti}`;
}

export async function imzaliYukleme(
  istek: YuklemeIstegi,
): Promise<YuklemeYaniti> {
  const { onek, contentType, bytes, userId, fileName } = istek;

  if (!ONEKLER.includes(onek)) {
    throw new Error(`Geçersiz önek: ${onek}`);
  }

  const uzanti = TURLER[contentType];
  if (!uzanti) {
    throw new Error(`Desteklenmeyen dosya türü: ${contentType}`);
  }
  // Video yalnızca yazar görsellerinde
  if (contentType === "video/mp4" && onek !== "editor" && onek !== "haber") {
    throw new Error("Video yalnızca haber görsellerinde kullanılabilir");
  }
  /*
   * Belge türleri YALNIZCA mail eklerinde. Kitaplığa ya da
   * avatar klasörüne PDF yüklenmesinin bir anlamı yok ve
   * yüzeyi gereksiz genişletir.
   */
  if (!contentType.startsWith("image/") && contentType !== "video/mp4" && onek !== "mail") {
    throw new Error("Bu dosya türü yalnızca mail ekinde kullanılabilir");
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error("Dosya boyutu okunamadı");
  }
  if (bytes > SINIR[onek]) {
    throw new Error(
      `Dosya çok büyük: ${Math.round(bytes / 1048576)} MB · ` +
      `sınır ${Math.round(SINIR[onek] / 1048576)} MB`,
    );
  }

  // avatar ve editor kullanıcı klasörüne yazar
  const kullaniciliOnek = onek === "avatar" || onek === "editor" || onek === "mail";
  if (kullaniciliOnek && !userId) {
    throw new Error("Oturum bulunamadı");
  }

  /*
   * Anahtara ZAMAN DAMGASI girer.
   *
   * Aynı ada üstüne yazmak, CDN önbelleği yüzünden eski görselin
   * saatlerce görünmesine yol açıyordu. Her yükleme yeni anahtar
   * alır; eskisi silme kuyruğuna düşer.
   */
  const damga = Date.now().toString(36);
  const ad = temizAd(fileName, uzanti);

  /*
   * ⚠ "haber" ÖNEĞİNDE YOL SUNUCUDAN GELİYOR.
   *
   * Haber medyası botun kullandığı düzene yazılmalı:
   *   news/YYYY/AA/GG/{haber_id}/dosya.jpg
   * Böylece haber silinince tüm medyası tek klasörde bulunup
   * temizlenebiliyor.
   *
   * Yolu veritabanı üretiyor (`admin_medya_yolu`) ve panel
   * `fileName` olarak gönderiyor. Ama İSTEMCİYE GÜVENİLMİYOR:
   * biçim burada da doğrulanıyor. Aksi hâlde panel yetkisi olan
   * biri bucket'ta istediği yere yazabilirdi.
   */
  let key: string;
  if (onek === "haber") {
    const yol = String(fileName ?? "");
    if (!/^news\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(yol)) {
      throw new Error("Geçersiz haber medya yolu");
    }
    key = yol;
  } else {
    key = kullaniciliOnek
      ? `${onek}/${userId}/${damga}-${ad}`
      : `${onek}/${damga}-${ad}`;
  }

  const expiresIn = 300;   // 5 dakika: yükleme başlatmaya fazlasıyla yeter

  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      /*
       * ContentLength imzaya DAHİL: istemci imzayı alıp
       * beyan ettiğinden büyük bir dosya yükleyemesin.
       */
      ContentLength: bytes,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn },
  );

  const cdn = (process.env.CDN_BASE ?? process.env.NEXT_PUBLIC_CDN_BASE ?? "")
    .replace(/\/+$/, "");

  return { url, key, publicUrl: cdn ? `${cdn}/${key}` : key, expiresIn };
}

/**
 * Doğrudan silme.
 *
 * Normalde silme `storage_deletions` kuyruğuna atılır ve botun
 * temizlik işçisi halleder — tek yerden, koruma katmanlarıyla.
 * Bu fonksiyon yalnızca YÜKLEME YARIDA KALIRSA (kullanıcı
 * vazgeçti, RPC hata verdi) artık dosyayı hemen temizlemek için.
 */
export async function r2Sil(key: string): Promise<void> {
  /*
   * ⚠ `media/` DE İZİNLİ.
   * Kullanıcı silinirken haberlerinin bot tarafından üretilmiş
   * görselleri de temizleniyor; önce yalnızca dört önek
   * kabul ediliyordu ve o dosyalar sessizce atlanıyordu.
   */
  if (!/^(avatar|library|editor|mail|media)\/[A-Za-z0-9._/-]{3,}$/.test(key)) {
    throw new Error("Güvensiz anahtar");
  }
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
