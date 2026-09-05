import type { ReactNode } from "react";
import Sidebar, { type NavGroup } from "./Sidebar";

/**
 * PANEL KABUĞU
 *
 * Solda koyu menü, sağda açık içerik. Menü sabit, içerik kayar.
 * İçerik 1180px'de duruyor: geniş ekranda satırlar aşırı uzayınca
 * tablo okumak zorlaşıyor.
 */
export default function Shell({
  groups, userName, role, logoDark, siteUrl, children,
}: {
  groups: NavGroup[];
  userName: string;
  role: string;
  logoDark: string | null;
  siteUrl: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-page lg:flex-row">
      <Sidebar
        groups={groups}
        userName={userName}
        role={role}
        logoDark={logoDark}
        siteUrl={siteUrl}
      />
      <main id="icerik" className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1180px]">{children}</div>
      </main>
    </div>
  );
}
