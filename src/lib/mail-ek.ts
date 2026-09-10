import "server-only";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * MAİL EKLERİNİ R2'DEN İNDİR
 *
 * Ekler yüklenirken medya kitaplığına (`library/`) gidiyor;
 * burada gönderim anında indiriliyor.
 *
 * ┌─ EKSİZ GÖNDERİLMEZ ⚠️ ────────────────────────────────────┐
 * │ İndirme başarısızsa hata fırlatılır ve mail HİÇ gitmez.    │
 * │ Ek beklenen bir mailin eksiz gitmesi, hiç gitmemesinden    │
 * │ kötü: alıcı "boş mail attın" der, gönderen fark etmez.     │
 * └──────────────────────────────────────────────────────────────┘
 */

export interface EkTanim {
  key: string; name?: string; size?: number; type?: string;
}
export interface HazirEk {
  filename: string; content: Buffer; contentType: string;
}

/** Sağlayıcıların çoğu 25 MB'ı reddediyor */
const TOPLAM_LIMIT = 24 * 1024 * 1024;

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT;
  const key = process.env.S3_ACCESS_KEY_ID;
  const secret = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !key || !secret) {
    throw new Error(
      "Ek indirilemedi: R2 ayarları eksik. Dokploy → Environment'ta " +
      "S3_ENDPOINT, S3_ACCESS_KEY_ID ve S3_SECRET_ACCESS_KEY tanımlı olmalı.",
    );
  }
  client = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: true,
  });
  return client;
}

async function oku(body: unknown): Promise<Buffer> {
  const p: Buffer[] = [];
  for await (const c of body as AsyncIterable<Uint8Array>) p.push(Buffer.from(c));
  return Buffer.concat(p);
}

export async function ekleriIndir(ekler: EkTanim[]): Promise<HazirEk[]> {
  if (!Array.isArray(ekler) || ekler.length === 0) return [];

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("Ek indirilemedi: S3_BUCKET tanımlı değil");

  const cikti: HazirEk[] = [];
  let toplam = 0;

  for (const e of ekler) {
    const k = String(e?.key ?? "");
    /*
     * Yalnızca kitaplık dosyaları. Gelen veriye güvenilmez;
     * yoksa bucket'taki herhangi bir dosya (haber medyası,
     * avatar) mail eki olarak gönderilebilirdi.
     */
    if (!/^library\/[A-Za-z0-9._/-]{3,200}$/.test(k) || k.includes("..")) {
      throw new Error(`Geçersiz ek: ${k.slice(0, 60)}`);
    }

    const res = await r2().send(new GetObjectCommand({ Bucket: bucket, Key: k }));
    const buf = await oku(res.Body);

    toplam += buf.length;
    if (toplam > TOPLAM_LIMIT) {
      throw new Error(
        `Ek toplamı ${Math.round(toplam / 1048576)} MB — sağlayıcı sınırı aşıldı`,
      );
    }

    cikti.push({
      filename: e.name ?? k.split("/").pop() ?? "dosya",
      content: buf,
      contentType: e.type ?? res.ContentType ?? "application/octet-stream",
    });
  }

  return cikti;
}
