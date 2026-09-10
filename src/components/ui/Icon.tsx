"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon, Analytics01Icon, News01Icon, Comment01Icon, UserGroup02Icon,
  Image01Icon, Mail01Icon, Settings01Icon, Clock01Icon, Logout01Icon,
  Menu01Icon, Cancel01Icon, Tick02Icon, Alert01Icon,
  ViewIcon, FavouriteIcon, BookmarkAdd01Icon, Bookmark02Icon, BookmarkCheck02Icon,
  StarIcon, Archive02Icon, ArrowLeft01Icon, ArrowRight01Icon, PlayIcon,
  Search02Icon, PlusSignIcon,
  Sun01Icon, Moon02Icon, PencilEdit01Icon, Delete02Icon, Copy01Icon,
  UserIcon, SentIcon, File01Icon, RefreshIcon, CheckmarkCircle02Icon,
  Camera01Icon, Loading03Icon,
} from "@hugeicons/core-free-icons";

/**
 * İKONLAR
 *
 * Tek dosyada eşleştirme: bileşenler ikon paketini tanımıyor,
 * yalnızca ad veriyor. Paket değişirse yalnızca burası değişir.
 */
const MAP = {
  home: Home01Icon,
  dashboard: Analytics01Icon,
  news: News01Icon,
  box: Archive02Icon,
  comment: Comment01Icon,
  users: UserGroup02Icon,
  user: UserIcon,
  media: Image01Icon,
  mail: Mail01Icon,
  settings: Settings01Icon,
  system: Clock01Icon,
  clock: Clock01Icon,
  logout: Logout01Icon,
  menu: Menu01Icon,
  close: Cancel01Icon,
  chevronRight: ArrowRight01Icon,
  check: Tick02Icon,
  warn: Alert01Icon,
  verified: CheckmarkCircle02Icon,
  eye: ViewIcon,
  heart: FavouriteIcon,
  /*
   * Kaydedilmiş mail yıldızı.
   *
   * Kütüphanede DOLU yıldız yok. Dolu görünümü `fill="currentColor"`
   * ile üretiliyor (bkz. Icon bileşenindeki `dolu` desteği) —
   * ayrı bir ikon paketi eklemekten hafif.
   */
  /* Geri: sol ok. Hamburger ikonu "menü aç" gibi duruyordu. */
  back: ArrowLeft01Icon,
  /* Liste kartında video işareti ve sayfalama okları */
  play: PlayIcon,
  chevronLeft: ArrowLeft01Icon,
  star: StarIcon,
  starFill: StarIcon,
  bookmark: Bookmark02Icon,
  /*
   * Dolu hâli için ayrı bir ikon yok; işaretli bookmark
   * kullanılıyor. Zaten arka planı da doluyor, ayrım net.
   */
  bookmarkFill: BookmarkCheck02Icon,
  bookmarkAdd: BookmarkAdd01Icon,
  search: Search02Icon,
  plus: PlusSignIcon,
  sun: Sun01Icon,
  moon: Moon02Icon,
  edit: PencilEdit01Icon,
  trash: Delete02Icon,
  copy: Copy01Icon,
  send: SentIcon,
  file: File01Icon,
  refresh: RefreshIcon,
  camera: Camera01Icon,
  loading: Loading03Icon,
  grid: Analytics01Icon,
  markets: Analytics01Icon,
  pin: Home01Icon,
} as const;

export type IconName = keyof typeof MAP;

export default function Icon({
  name, size = 18, strokeWidth = 1.7, color, dolu = false,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /**
   * İçi dolu çizim.
   *
   * Kütüphanede her ikonun dolu sürümü yok (yıldız gibi).
   * `fill` vererek aynı ikondan dolu görünüm elde ediliyor —
   * ikinci bir ikon paketi eklemekten çok daha hafif.
   */
  dolu?: boolean;
}) {
  /*
   * ⚠ TANIMSIZ İKON SAYFAYI ÇÖKERTİYORDU.
   *
   * `MAP[name]` bulunamayınca `HugeiconsIcon` içeride onu
   * yinelemeye çalışıyor ve şu hatayı veriyor:
   *   TypeError: (intermediate value) is not iterable
   *
   * Bu bir SAYFA ÇÖKMESİ — tek bir yazım hatası yüzünden
   * "Application error" ekranı geliyordu. Artık eksik ikon
   * sessizce atlanıyor; ekranın kalanı çalışmaya devam ediyor.
   */
  const cizim = MAP[name];
  if (!cizim) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Icon] bilinmeyen ikon: ${String(name)}`);
    }
    return <span style={{ display: "inline-block", width: size, height: size }} />;
  }

  return (
    <HugeiconsIcon
      icon={cizim}
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? "currentColor"}
      fill={dolu ? "currentColor" : "none"}
    />
  );
}
