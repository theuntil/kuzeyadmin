import { requireAdmin } from "@/lib/admin";
import { buildNav } from "@/lib/nav";
import { getConfig } from "@/lib/config";
import Shell from "@/components/admin/Shell";

export const dynamic = "force-dynamic";

/**
 * PANEL KABUĞU — LAYOUT
 *
 * ┌─ NEDEN LAYOUT, SAYFA DEĞİL ⚠️ ────────────────────────────┐
 * │ Kabuk her sayfada ayrı ayrı çiziliyordu. `loading.tsx`      │
 * │ devreye girince MENÜ DE KAYBOLUYOR, ekranda sadece iskelet │
 * │ kalıyordu — sayfa geçişlerinde panel "yeniden açılıyor"    │
 * │ gibi duruyordu.                                              │
 * │                                                              │
 * │ Layout'a taşınınca kenar çubuğu SABİT kalıyor. Yalnızca    │
 * │ içerik alanı yenileniyor; iskelet de yalnızca orada         │
 * │ görünüyor (bkz. `loading.tsx`).                             │
 * │                                                              │
 * │ `(panel)` bir ROTA GRUBU: adreslerde görünmez. `/giris` ve │
 * │ `/yetkisiz` bu grubun dışında olduğu için kabuk almaz.      │
 * └──────────────────────────────────────────────────────────────┘
 */
export default async function PanelLayout({
  children,
}: { children: React.ReactNode }) {
  /*
   * Yetki burada bir kez kontrol ediliyor. Sayfalar `requireAdmin`
   * çağırmaya devam ediyor — ikinci katman: yeni bir sayfa
   * eklendiğinde layout'a güvenip kontrolü unutma riski kalmasın.
   */
  const { sb, role, profile } = await requireAdmin();
  const cfg = getConfig();

  const [{ data: ov }, { data: st }] = await Promise.all([
    sb.from("admin_overview").select("bekleyen_haber, bekleyen_yorum").maybeSingle(),
    sb.from("public_site_settings").select("logo_dark_key, logo_light_key").maybeSingle(),
  ]);

  const logoKey = (st?.logo_dark_key ?? st?.logo_light_key) as string | null;

  return (
    <Shell
      groups={buildNav(role, {
        articles: Number(ov?.bekleyen_haber ?? 0),
        comments: Number(ov?.bekleyen_yorum ?? 0),
      })}
      userName={(profile?.display_name as string) ?? ""}
      role={role}
      logoDark={logoKey ? `${cfg.cdnBase.replace(/\/+$/, "")}/${logoKey}` : null}
      siteUrl={cfg.siteUrl}
    >
      {children}
    </Shell>
  );
}
