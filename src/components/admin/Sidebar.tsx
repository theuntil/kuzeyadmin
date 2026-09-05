"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import Icon, { type IconName } from "@/components/ui/Icon";
import ThemeToggle from "./ThemeToggle";
import { ConfirmDialog } from "@/components/ui/modal";
import Link from "next/link";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  badge?: number;
  adminOnly?: boolean;
}

export interface NavGroup { title: string; items: NavItem[] }

/**
 * KENAR ÇUBUĞU
 *
 * Her iki temada da KOYU. Gezinme ile içeriği ayırmanın en net
 * yolu bu; göz sürekli menüye kaymıyor.
 *
 * Menü GRUPLANMIŞ: on beş öğe düz liste hâlinde tarama gerektirir,
 * başlıklarla ayrılınca aranan yer bir bakışta bulunur.
 *
 * Mobilde çekmece olarak açılır; masaüstünde sabit durur.
 */
export default function Sidebar({
  groups, userName, role, logoDark, siteUrl,
}: {
  groups: NavGroup[];
  userName: string;
  role: string;
  logoDark: string | null;
  siteUrl: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Sayfa değişince çekmece kapansın
  useEffect(() => { setOpen(false); }, [pathname]);

  async function logout() {
    setLeaving(true);
    await supabaseBrowser().auth.signOut();
    window.location.href = "/giris";
  }

  const body = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          {logoDark ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoDark} alt="" className="h-7 w-auto object-contain" />
          ) : (
            <span className="font-display text-[15px] font-semibold tracking-[-.02em] text-deep-ink">
              Kuzeybatı
            </span>
          )}
          <span className="text-[10.5px] font-bold tracking-[.14em] text-deep-muted">
            YÖNETİM
          </span>
        </Link>
        <button
          onClick={() => setOpen(false)}
          aria-label="Menüyü kapat"
          className="flex h-9 w-9 items-center justify-center rounded-full text-deep-muted lg:hidden"
        >
          <Icon name="close" size={17} />
        </button>
      </div>

      <nav className="ct-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => {
          if (g.items.length === 0) return null;
          return (
            <div key={g.title} className="mb-5">
              <span className="mb-1.5 block px-3.5 text-[10px] font-bold tracking-[.14em] text-deep-muted/70">
                {g.title}
              </span>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = it.exact
                    ? pathname === it.href
                    : pathname === it.href || pathname.startsWith(it.href + "/");
                  return (
                    <li key={it.href}>
                      <a
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-[11px] px-3.5 py-[10px] text-[14px] transition-colors",
                          // Seçili sayfa NÖTR (siyah/beyaz), kırmızı değil —
                          // marka rengi yalnızca birincil eylem düğmelerinde.
                          active
                            ? "bg-solid font-semibold text-on-solid"
                            : "text-on-dark hover:bg-white/[.06]",
                        )}
                      >
                        <Icon name={it.icon} size={16} />
                        <span className="flex-1">{it.label}</span>
                        {it.badge ? (
                          <span className={cn(
                            "flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-bold",
                            active ? "bg-on-solid/20 text-on-solid" : "bg-orange text-white",
                          )}>
                            {it.badge > 99 ? "99+" : it.badge}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12.5px] font-semibold text-deep-ink">{userName}</span>
          <span className="truncate text-[11px] text-deep-muted">
            {role === "admin" ? "Yönetici" : "Yazar"}
          </span>
        </div>
        <Link
          href={siteUrl}
          title="Siteye git"
          className="flex h-8 w-8 items-center justify-center rounded-full text-deep-muted transition-colors hover:bg-white/[.06] hover:text-deep-ink"
        >
          <Icon name="home" size={16} />
        </Link>
        <ThemeToggle />
        <button
          onClick={() => setConfirmOut(true)}
          aria-label="Çıkış yap"
          title="Çıkış yap"
          className="flex h-8 w-8 items-center justify-center rounded-full text-deep-muted transition-colors hover:bg-white/[.06] hover:text-brand"
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobil üst çubuk */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line"
        >
          <Icon name="menu" size={18} />
        </button>
        <span className="font-display text-[15px] font-semibold">Yönetim</span>
        <ThemeToggle />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="ct-fade absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside
            className="absolute left-0 top-0 flex h-full w-[270px] flex-col bg-sidebar"
            style={{ animation: "ct-slide-in .25s cubic-bezier(.22,1,.36,1) both" }}
          >
            {body}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col bg-sidebar lg:flex">
        {body}
      </aside>
      <ConfirmDialog
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        onConfirm={logout}
        loading={leaving}
        title="Çıkış yapmak istiyor musunuz?"
        description="Yönetim paneli oturumunuz kapatılacak."
        confirmLabel="Çıkış yap"
      />
    </>
  );
}
