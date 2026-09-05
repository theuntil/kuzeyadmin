"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Badge, EmptyState } from "@/components/ui";
import { d } from "@/lib/utils";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   YAZARLAR

   Yazar kadrosu ve yayın istatistikleri. "Yazarlarımız"
   sayfasında görünürlük buradan açılıp kapatılıyor.

   ┌─ NEDEN KULLANICILAR EKRANINDAN AYRI ⚠️ ───────────────────┐
   │ `Kullanıcılar` tüm hesapları listeliyor — okurlar dahil,  │
   │ binlerce satır olabiliyor. Yazar kadrosu orada kayboluyor │
   │ ve yanında yayın sayıları görünmüyordu.                    │
   │                                                              │
   │ Bu ekran `admin_yazarlar` görünümünü kullanıyor: yalnızca │
   │ author/editor/admin rolleri, yanında toplam · yayında ·    │
   │ bekleyen haber ve yorum sayıları.                           │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Yazar {
  id: string;
  username: string | null;
  display_name: string;
  avatar_key: string | null;
  title: string | null;
  role: string;
  is_active: boolean;
  yazarlar_sayfasinda: boolean;
  dogrudan_yayin: boolean;
  created_at: string;
  last_seen_at: string | null;
  haber_toplam: number;
  haber_yayinda: number;
  haber_bekleyen: number;
  yorum_toplam: number;
}

export default function YazarlarPanel({ cdn }: { cdn: string }) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [liste, setListe] = useState<Yazar[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [islem, setIslem] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb
      .from("admin_yazarlar")
      .select("*")
      .order("haber_yayinda", { ascending: false });
    setYukleniyor(false);

    if (error) { t.error("Yazarlar okunamadı: " + error.message); return; }
    setListe((data ?? []) as Yazar[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  async function gorunurluk(id: string, yeni: boolean) {
    setIslem(id);
    const { error } = await sb.rpc("admin_yazar_gorunurluk", {
      p_user_id: id,
      p_gorunur: yeni,
    });
    setIslem(null);

    if (error) { t.error(error.message); return; }

    /* Yerinde güncelleniyor — listeyi tekrar çekmeye gerek yok */
    setListe((p) =>
      p.map((y) => (y.id === id ? { ...y, yazarlar_sayfasinda: yeni } : y)),
    );
    t.success(yeni ? "Yazarlarımız sayfasında görünecek" : "Sayfadan kaldırıldı");
  }

  const url = (k: string | null) =>
    k ? `${cdn.replace(/\/+$/, "")}/${k}` : null;

  if (yukleniyor) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-surface2" />
        ))}
      </div>
    );
  }

  if (liste.length === 0) {
    return (
      <EmptyState
        title="Yazar yok"
        description="Bir kullanıcıya yazar rolü verildiğinde burada görünür."
      />
    );
  }

  const gorunen = liste.filter((y) => y.yazarlar_sayfasinda).length;

  return (
    <div className="grid gap-4">
      <p className="text-[12.5px] leading-relaxed text-muted2">
        {liste.length} yazar · {gorunen} tanesi &ldquo;Yazarlarımız&rdquo;
        sayfasında görünüyor. Görünürlük varsayılan olarak kapalıdır.
      </p>

      <div className="grid gap-3">
        {liste.map((y) => {
          const avatar = url(y.avatar_key);
          const mesgul = islem === y.id;

          return (
            <article
              key={y.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-full bg-surface2 text-[18px] font-extrabold text-muted2">
                {avatar ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  y.display_name.slice(0, 1).toUpperCase()
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/kullanici/${y.id}`}
                    className="truncate text-[15px] font-bold hover:underline"
                  >
                    {y.display_name}
                  </Link>
                  {y.role !== "author" && <Badge tone="accent">{y.role}</Badge>}
                  {!y.is_active && <Badge tone="danger">Kapalı</Badge>}
                  {y.dogrudan_yayin && <Badge tone="green">Doğrudan yayın</Badge>}
                </div>

                <div className="truncate text-[12.5px] text-muted2">
                  {[
                    y.username ? `@${y.username}` : null,
                    y.title,
                    `Katılım ${d(y.created_at)}`,
                  ].filter(Boolean).join(" · ")}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted2">
                  <span><b className="text-fg">{y.haber_yayinda}</b> yayında</span>
                  {y.haber_bekleyen > 0 && (
                    <span className="text-accent">
                      <b>{y.haber_bekleyen}</b> onay bekliyor
                    </span>
                  )}
                  <span><b className="text-fg">{y.haber_toplam}</b> toplam</span>
                  <span><b className="text-fg">{y.yorum_toplam}</b> yorum</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {/*
                  GÖRÜNÜRLÜK ANAHTARI

                  ⚠ Kullanıcı adı olmayan yazar listelenemiyor:
                  profil sayfasının adresi kullanıcı adından
                  kuruluyor, o olmadan bağlantı kırık olurdu.
                */}
                <label
                  className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold"
                  title={
                    y.username
                      ? "Yazarlarımız sayfasında görünsün"
                      : "Kullanıcı adı olmayan yazar listelenemez"
                  }
                >
                  <input
                    type="checkbox"
                    checked={y.yazarlar_sayfasinda}
                    disabled={mesgul || !y.username}
                    onChange={(e) => void gorunurluk(y.id, e.target.checked)}
                    className="h-[18px] w-[18px] accent-fg disabled:opacity-40"
                  />
                  Sayfada göster
                </label>

                <Link
                  href={`/kullanici/${y.id}`}
                  className="rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold"
                >
                  İncele
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
