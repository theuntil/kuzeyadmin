"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import Icon from "@/components/ui/Icon";
import { ConfirmDialog } from "@/components/ui/modal";
import { kapakAdresi, type KapakBilgi } from "@/lib/medya-adres";

/* ══════════════════════════════════════════════════════════════
   YAZARIN HABERLERİ

   Kullanıcı detay sayfasında, yalnızca yazar/editör rolündeki
   kişiler için görünüyor.

   ⚠ AYRI BİR YAZAR SAYFASI AÇILMADI.
   Yazarlar zaten `profiles` kaydı; bu sayfa bilgileri
   düzenlemeyi hâlihazırda yapıyor. İkinci bir sayfa aynı işi
   iki yerde bakım demekti.
   ══════════════════════════════════════════════════════════════ */

interface Haber {
  id: string;
  slug: string;
  baslik: string;
  durum: string;
  kategori: string | null;
  yayin_tarihi: string | null;
  okuma: number;
  degisiklik_bekliyor: boolean;
  kapak: KapakBilgi | null;
}

const DURUM: Record<string, { l: string; t: "accent" | "muted" | "danger" }> = {
  published:      { l: "Yayında",      t: "accent" },
  pending_review: { l: "Onay bekliyor", t: "muted" },
  draft:          { l: "Taslak",       t: "muted" },
  rejected:       { l: "Reddedildi",   t: "danger" },
  archived:       { l: "Arşiv",        t: "muted" },
};

export default function YazarHaberleri({
  userId, cdnBase = "",
}: { userId: string; cdnBase?: string }) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [liste, setListe] = useState<Haber[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [silinecek, setSilinecek] = useState<Haber | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_yazar_haberleri", {
      p_id: userId, p_limit: 50,
    });
    setYukleniyor(false);
    if (error) { t.error("Haberler okunamadı: " + error.message); return; }
    setListe((data ?? []) as Haber[]);
  }, [sb, t, userId]);

  useEffect(() => { void yukle(); }, [yukle]);

  async function sil() {
    if (!silinecek) return;
    setSiliniyor(true);

    /*
     * ⚠ İYİMSER DEĞİL.
     * Silme geri alınamaz bir işlem; sunucu onaylamadan listeden
     * çıkarmak, başarısız olduğunda haberin gitmiş gibi
     * görünmesine yol açardı.
     */
    const { error } = await sb.rpc("admin_haber_sil", { p_id: silinecek.id });
    setSiliniyor(false);

    if (error) { t.error("Silinemedi: " + error.message); return; }
    t.success("Haber silindi");
    setSilinecek(null);
    await yukle();
  }

  if (yukleniyor) {
    return (
      <div className="grid gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface2" />
        ))}
      </div>
    );
  }

  if (liste.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-muted2">
        Bu yazarın henüz haberi yok.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-2">
        {liste.map((h) => {
          const d = DURUM[h.durum] ?? { l: h.durum, t: "muted" as const };
          return (
            <div
              key={h.id}
              className="flex items-center gap-3 rounded-xl border border-line p-3"
            >
              {/*
                ⚠ KAPAK ÜÇ KAYNAKTAN.
                Doğrudan adres, kitaplık görseli ya da videonun
                poster karesi — hangisi varsa. Sunucu bu sırayla
                çözüyor.
              */}
              <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-chip">
                {kapakAdresi(h.kapak, cdnBase, "thumb") && (
                  <img
                    src={kapakAdresi(h.kapak, cdnBase, "thumb")!}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {h.baslik}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted2">
                  <span
                    className={
                      d.t === "accent" ? "text-emerald-500"
                      : d.t === "danger" ? "text-red-500" : ""
                    }
                  >
                    {d.l}
                  </span>
                  {h.degisiklik_bekliyor && (
                    /* Yayında ama onay bekleyen değişikliği var */
                    <span className="font-semibold text-amber-500">
                      onay bekleyen değişiklik
                    </span>
                  )}
                  {h.durum === "pending_review" && (
                    <span className="font-semibold text-amber-500">
                      onay bekliyor
                    </span>
                  )}
                  {h.kategori && <span>· {h.kategori}</span>}
                  <span>· {h.okuma.toLocaleString("tr-TR")} okunma</span>
                </span>
              </span>

              <Link
                href={`/haberler/${h.id}`}
                title="Düzenle"
                aria-label={`${h.baslik} düzenle`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line"
              >
                <Icon name="edit" size={15} />
              </Link>

              <button
                type="button"
                onClick={() => setSilinecek(h)}
                title="Sil"
                aria-label={`${h.baslik} sil`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/40 text-red-500"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(silinecek)}
        title="Haber silinsin mi?"
        description={
          silinecek
            ? `"${silinecek.baslik}" silinecek. Yayından kalkar ve `
              + "listelerde görünmez."
            : ""
        }
        confirmLabel="Sil"
        loading={siliniyor}
        onConfirm={() => void sil()}
        onClose={() => setSilinecek(null)}
      />
    </>
  );
}
