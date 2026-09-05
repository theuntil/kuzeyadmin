import type { NavGroup } from "@/components/admin/Sidebar";

/**
 * MENÜ YAPISI
 *
 * Gruplu: on beş öğe düz listede tarama gerektirir; başlıklarla
 * ayrılınca aranan yer bir bakışta bulunur.
 *
 * Yazar yalnızca kendi içeriğini görür; yönetim bölümleri
 * `adminOnly` ile gizlenir.
 */
export function buildNav(
  role: string,
  counts: { articles: number; comments: number },
): NavGroup[] {
  const admin = role === "admin";

  const groups: NavGroup[] = [
    {
      title: "GENEL",
      items: [
        { href: "/", label: "Gösterge paneli", icon: "dashboard", exact: true },
        { href: "/istatistik", label: "İstatistikler", icon: "eye" },
      ],
    },
    {
      title: "İÇERİK",
      items: [
        /*
         * Onay kuyruğu HABERLER'DEN ÖNCE.
         * Panele giren yöneticinin ilk görmesi gereken,
         * bekleyen iş. Rozet bekleyen haber sayısını taşıyor.
         */
        { href: "/onay", label: "Onay bekleyenler", icon: "clock",
          badge: counts.articles || undefined },
        { href: "/haberler", label: "Haberler", icon: "news" },
        { href: "/yorumlar", label: "Yorumlar", icon: "comment",
          badge: counts.comments || undefined },
        { href: "/medya", label: "Medya", icon: "media" },
        { href: "/kategoriler", label: "Kategoriler", icon: "grid" },
      ],
    },
  ];

  if (admin) {
    groups.push(
      {
        title: "KULLANICILAR",
        items: [
          { href: "/kullanici", label: "Kullanıcılar", icon: "users" },
          /*
           * Yazarlar ayrı bir ekran.
           *
           * ⚠ Kullanıcılar listesi tüm hesapları kapsıyor ve
           * binlerce satır olabiliyor; yazar kadrosu orada
           * kayboluyordu. Bu ekran yalnızca yazar/editör/admin
           * rollerini gösteriyor ve yayın istatistiklerini
           * yanına koyuyor.
           */
          { href: "/yazarlar", label: "Yazarlar", icon: "edit" },
        ],
      },
      {
        title: "SİSTEM",
        items: [
          /*
           * TEK MAİL GİRDİSİ.
           *
           * Önce üç ayrı menü öğesi vardı (mail, ayarlar, şablon)
           * ve kullanıcı hangisine gireceğini bilemiyordu.
           * Ayarlar artık mail ekranının sağ üstündeki dişli
           * düğmesinden açılıyor — posta istemcilerinin
           * alışılmış yeri.
           */
          { href: "/mail", label: "Mail", icon: "mail" },
          { href: "/ayarlar", label: "Site ayarları", icon: "settings" },
          { href: "/icerik", label: "Site içeriği", icon: "grid" },
          /*
           * Politikalar ayrı bir ekran.
           *
           * ⚠ "Site içeriği"nin altında değil, YANINDA.
           * Yasal metinler sürümlü ve onay takipli; sıradan
           * sayfalarla aynı ekranda olması ikisinin farklı
           * kurallara tabi olduğunu gizliyordu.
           */
          { href: "/politikalar", label: "Politikalar", icon: "box" },
          /*
           * ⚠ "Logo ve görünüm" AYRI MADDE DEĞİL.
           * Aynı tabloyu düzenliyordu; site ayarlarının
           * "Görünüm" sekmesine taşındı. `/gorunum` adresi
           * hâlâ çalışıyor — eski yer imleri kırılmasın.
           */
          { href: "/bot", label: "İHA botu", icon: "system" },
          { href: "/ai", label: "AI servisi", icon: "dashboard" },
          { href: "/prompt", label: "Prompt ve şema", icon: "edit" },
          { href: "/kaynaklar", label: "Haber kaynakları", icon: "system" },
          { href: "/kayitlar", label: "Kayıtlar", icon: "clock" },
        ],
      },
    );
  }

  return groups;
}
