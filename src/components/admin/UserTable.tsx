"use client";
import { useState, useMemo } from "react";
import { Input, Badge, EmptyState } from "@/components/ui";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   KULLANICI LİSTESİ

   ┌─ SATIRDA İŞLEM YOK ⚠️ ────────────────────────────────────┐
   │ Önce her satırın sonunda rol seçici ve aç/kapa anahtarı    │
   │ vardı. İki sorun:                                            │
   │   • Yanlışlıkla tıklama riski — rol değişikliği geri        │
   │     alınamayan bir işlem                                     │
   │   • 15 satırlık listede 30 kontrol; ekran okunmuyordu       │
   │                                                              │
   │ Artık satır yalnızca BİLGİ gösteriyor. Tüm işlemler         │
   │ kullanıcıya tıklayınca açılan detay sayfasında.             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface UserRow {
  id: string;
  role: string;
  display_name: string;
  username: string | null;
  email: string | null;
  avatar_key: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
  dogrulanmis: boolean;
  city_name: string | null;
  yorum_sayisi: number;
  haber_sayisi: number;
  engelli: boolean;
  bas_harf: string;
}

const ROL_ETIKET: Record<string, string> = {
  admin: "Yönetici", editor: "Editör", author: "Yazar", reader: "Okuyucu",
};

/** Harf avatarı için sabit renk — aynı kişi her zaman aynı tonu alsın */
function tonIndeks(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export default function UserTable({
  users, cdnBase,
}: {
  users: UserRow[];
  cdnBase: string;
}) {
  const [arama, setArama] = useState("");
  const cdn = cdnBase.replace(/\/+$/, "");

  const gorunen = useMemo(() => {
    const a = arama.trim().toLowerCase();
    return users.filter((u) =>
      (!a ||
        u.display_name.toLowerCase().includes(a) ||
        (u.username ?? "").toLowerCase().includes(a) ||
        (u.email ?? "").toLowerCase().includes(a)),
    );
  }, [users, arama]);



  return (
    <div className="flex flex-col gap-4">


      <Input
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="Ad, kullanıcı adı ya da e-posta ara"
      />

      {gorunen.length === 0 ? (
        <EmptyState title="Kullanıcı yok" description="Aramayı değiştirmeyi dene." />
      ) : (
        <div className="kb-stagger flex flex-col gap-2">
          {gorunen.map((u) => {
            const foto = u.avatar_key ? `${cdn}/${u.avatar_key}` : u.avatar_url;
            const ton = tonIndeks(u.id);

            return (
              <Link
                key={u.id}
                href={`/kullanici/${u.id}`}
                className="kb-lift flex items-center gap-3.5 rounded-[16px] bg-surface p-3.5 transition-colors hover:bg-chip"
              >
                {/* ── Avatar: fotoğraf yoksa baş harf ── */}
                <span className="relative shrink-0">
                  {foto ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={foto} alt="" loading="lazy"
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-full text-[16px] font-bold text-white"
                      style={{ background: `hsl(${ton} 45% 32%)` }}
                    >
                      {u.bas_harf}
                    </span>
                  )}
                  {u.engelli && (
                    <span
                      aria-label="Engelli"
                      className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] text-white"
                    >
                      ✕
                    </span>
                  )}
                </span>

                {/* ── Bilgi ── */}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">
                      {u.display_name}
                    </span>
                    {u.dogrulanmis && (
                      <Icon name="verified" size={14} />
                    )}
                    <Badge tone={u.role === "admin" ? "accent" : "muted"}>
                      {ROL_ETIKET[u.role] ?? u.role}
                    </Badge>
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                    {u.email ?? (u.username ? `@${u.username}` : "—")}
                    {u.city_name ? ` · ${u.city_name}` : ""}
                  </span>
                </span>


              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
