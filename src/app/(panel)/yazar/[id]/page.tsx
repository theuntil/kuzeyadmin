import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getConfig } from "@/lib/config";
import YazarDetay from "@/components/admin/YazarDetay";
import Icon from "@/components/ui/Icon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * YAZAR DETAYI
 *
 * ⚠ VERİ İSTEMCİDE ÇEKİLİYOR.
 * Sayfa yalnızca kabuğu basıyor; bilgiler, sayılar ve haber
 * listesi bileşenin içinde yükleniyor. Böylece kaydetme ya da
 * görünürlük değişimi sonrası sayfanın tamamı yeniden
 * üretilmiyor.
 */
export default async function YazarPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  /* Geçersiz kimlikle veritabanına gitmeye gerek yok */
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  await requireAdmin(true);
  const cfg = getConfig();

  return (
    <>
      <Link
        href="/yazarlar"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted2 hover:text-ink"
      >
        <Icon name="back" size={15} /> Yazarlar
      </Link>

      <YazarDetay id={id} cdnBase={cfg.cdnBase} />
    </>
  );
}
