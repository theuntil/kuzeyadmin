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

  /*
   * ⚠ ÜÇÜ PARALEL.
   * Sırayla beklenirse her sayfa açılışına üç gidiş dönüş
   * eklenir. Posta sayacı hata verirse rozet 0 kalıyor,
   * menü yine çiziliyor.
   */
  const [{ data: ov }, { data: st }, { data: posta }] = await Promise.all([
    sb.from("admin_overview").select("bekleyen_haber, bekleyen_yorum").maybeSingle(),
    sb.from("public_site_settings").select("logo_dark_key, logo_light_key").maybeSingle(),
    sb.rpc("admin_okunmamis_posta"),
  ]);

  /*
   * ┌─ MENÜ LOGOSU TEMAYA UYMUYORDU ⚠️ ─────────────────────────┐
   * │ Sunucu koşulsuz KOYU logoyu seçiyordu; menü açık temaya   │
   * │ geçince koyu logo açık zeminde kayboluyordu.               │
   * │                                                              │
   * │ İkisi de gönderiliyor, seçimi tarayıcı yapıyor — tema     │
   * │ orada biliniyor.                                             │
   * └──────────────────────────────────────────────────────────────┘
   */
  const cdn = cfg.cdnBase.replace(/\/+$/, "");
  const adres = (k: unknown) =>
    typeof k === "string" && k ? `${cdn}/${k}` : null;

  /*
   * ⚠ YEDEĞE DÜŞÜLMÜYOR.
   * Önce açık logo yoksa koyu logoya düşülüyordu; sonuç açık
   * temada koyu logo — yani sorunun kendisi. Artık `null`
   * geçiyor ve kenar çubuğu görünür bir yedek uyguluyor.
   */
  const logoDark = adres(st?.logo_dark_key);
  const logoLight = adres(st?.logo_light_key);

  return (
    <Shell
      groups={buildNav(role, {
        articles: Number(ov?.bekleyen_haber ?? 0),
        comments: Number(ov?.bekleyen_yorum ?? 0),
        /* Okunmamış gelen posta — onay bekleyen yorum rozetiyle aynı biçim */
        mail: Number(posta ?? 0),
      })}
      userName={(profile?.display_name as string) ?? ""}
      role={role}
      logoDark={logoDark}
      logoLight={logoLight}
      siteUrl={cfg.siteUrl}
    >
      {children}
    </Shell>
  );
}
