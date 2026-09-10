import * as React from "react";
import { cn, type ToneName } from "@/lib/utils";
import Link from "next/link";

/* ══════════════════════ BUTTON ══════════════════════ */

type ButtonVariant = "solid" | "ink" | "accent" | "outline" | "ghost" | "orange" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "kb-lift inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap " +
  "transition-[transform,background-color,color,border-color,opacity] duration-200 ease-out " +
  "active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none select-none";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  /* Nötr birincil eylem: açık temada SİYAH, koyu temada AÇIK.
     Marka rengi her yerde kullanılınca ekran yoruyor; yoğun
     ekranlarda ana eylem bunu kullanır. */
  solid: "bg-solid text-on-solid hover:opacity-90",
  ink: "bg-solid text-on-solid hover:opacity-90",
  // ★ Marka vurgusu — sayfadaki tek "asıl" düğme
  accent: "bg-accent text-accent-ink hover:brightness-[.94]",
  orange: "bg-orange text-white hover:opacity-90",
  outline: "border border-line2 bg-chip text-ink hover:brightness-125",
  ghost: "text-ink2 hover:bg-chip hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
};

/* Düğmeler dolgun: yükseklik güven veriyor, dokunma alanı mobilde rahat */
const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[13.5px]",
  md: "px-5 py-[12px] text-[14.5px]",
  lg: "px-7 py-[15px] text-[15.5px]",
};

export function buttonClass(
  variant: ButtonVariant = "solid", size: ButtonSize = "md", extra?: string,
) {
  return cn(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "solid", size = "md", loading, className, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)}
            disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href, variant = "solid", size = "md", className, children, target, rel,
}: {
  href: string; variant?: ButtonVariant; size?: ButtonSize;
  className?: string; children: React.ReactNode;
  target?: string; rel?: string;
}) {
  return (
    <a href={href} target={target} rel={rel} className={buttonClass(variant, size, className)}>
      {children}
    </a>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("kb-spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent", className)}
    />
  );
}

/* ══════════════════════ CARD / SURFACE ══════════════════════ */

export function Card({
  className, children, as: As = "div",
}: { className?: string; children: React.ReactNode; as?: React.ElementType }) {
  /*
   * KENARLIK YOK. Kart zeminden TON FARKIYLA ayrılıyor; siyah
   * üstünde ince gri çizgi ızgara etkisi yaratıyordu.
   */
  return <As className={cn("rounded-[20px] bg-surface", className)}>{children}</As>;
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-[26px] bg-surface", className)}
         style={{ boxShadow: "var(--shadow)" }}>
      {children}
    </div>
  );
}

/* ══════════════════════ TİPOGRAFİ ══════════════════════ */

export function H1({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h1 className={cn("kb-h1", className)}>{children}</h1>;
}
export function H2({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn("kb-h2", className)}>{children}</h2>;
}
export function H3({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("kb-h3", className)}>{children}</h3>;
}
export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("kb-eyebrow", className)}>{children}</span>;
}
export function Lead({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-[15px] leading-[1.65] text-ink2 sm:text-[16px]", className)}>{children}</p>;
}

/* ══════════════════════ BADGE / PILL ══════════════════════ */

const TONE: Record<ToneName, string> = {
  green: "bg-green-soft text-green border-transparent",
  orange: "bg-orange-soft text-orange-ink border-orange-line",
  danger: "bg-danger-soft text-danger border-transparent",
  accent: "bg-accent text-accent-ink border-transparent",
  muted: "bg-chip text-ink2 border-transparent",
};

export function Badge({
  tone = "muted", className, children,
}: { tone?: ToneName; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold",
      TONE[tone], className,
    )}>
      {children}
    </span>
  );
}

export function Dot({ tone = "orange" }: { tone?: ToneName }) {
  const bg = tone === "green" ? "bg-green"
    : tone === "danger" ? "bg-danger"
    : tone === "accent" ? "bg-accent" : "bg-orange";
  return <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", bg)} />;
}

export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-2.5 self-start rounded-full border border-line bg-surface px-3.5 py-[7px] text-[13px] font-semibold text-ink2",
      className,
    )}>
      {children}
    </div>
  );
}

/* ══════════════════════ FORM ══════════════════════ */

const FIELD =
  "w-full rounded-[12px] border border-line2 bg-field px-4 py-3 text-[14.5px] text-ink " +
  "placeholder:text-muted2 transition-colors duration-150 " +
  "focus:border-accent focus:outline-none disabled:opacity-60";

export function Label({
  htmlFor, children, hint,
}: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor}
           className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-ink2">
      <span>{children}</span>
      {hint && <span className="text-[12px] font-normal text-muted2">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(FIELD, className)} {...rest} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(FIELD, "min-h-[120px] resize-y leading-[1.6]", className)} {...rest} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(FIELD, "cursor-pointer appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23909090' stroke-width='2'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")" }}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

export function Field({
  label, hint, error, htmlFor, children,
}: {
  label: string; hint?: string; error?: string | null;
  htmlFor?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor} hint={hint}>{label}</Label>
      {children}
      {error && <span className="text-[12.5px] font-medium text-danger">{error}</span>}
    </div>
  );
}

/**
 * ANAHTAR
 *
 * `<label>` içinde gizli checkbox KULLANILMAZ: etikete tıklamak
 * hem span'ın onClick'ini hem checkbox'ın onChange'ini
 * tetikliyordu. İki kez değişince değer aynı kalıyor ve anahtar
 * "çalışmıyor" görünüyordu. Tek button yeterli.
 */
export function Switch({
  checked, onChange, disabled, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200",
        /* Açık durum NÖTR (ters zemin), yeşil değil. Yeşil "onaylandı"
           anlamı taşıyor; bir anahtarın açık olması onay değil. */
        checked ? "bg-solid" : "bg-chip",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-5 w-5 rounded-full shadow transition-all duration-200",
          checked ? "bg-on-solid" : "bg-page",
        )}
        style={{ insetInlineStart: checked ? 23 : 3 }}
      />
    </button>
  );
}

/** Ayar satırı: etiket + açıklama + kontrol */
export function SettingRow({
  label, desc, children, first,
}: { label: string; desc?: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={cn("flex items-center gap-4 py-3.5", !first && "border-t border-line2")}>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold">{label}</div>
        {desc && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ══════════════════════ DURUM GÖSTERGELERİ ══════════════════════ */

export function Alert({
  tone = "orange", title, children,
}: { tone?: ToneName; title?: string; children: React.ReactNode }) {
  return (
    <div className={cn("kb-fade rounded-[16px] border px-4 py-3.5 text-[13.5px] leading-[1.6]", TONE[tone])}
         role="status">
      {title && <div className="mb-1 font-bold">{title}</div>}
      {children}
    </div>
  );
}

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: React.ReactNode; title: string;
  description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="kb-fade flex flex-col items-center gap-4 rounded-[20px] border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
      {icon && <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-chip text-muted">{icon}</div>}
      <div className="flex flex-col gap-1.5">
        <span className="font-display text-[18px] font-semibold">{title}</span>
        {description && <span className="max-w-[420px] text-[14px] leading-[1.6] text-muted">{description}</span>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("kb-skeleton rounded-[12px]", className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line2", className)} />;
}

export function StatBlock({
  value, label, tone,
}: { value: React.ReactNode; label: string; tone?: "green" | "orange" }) {
  const color = tone === "orange" ? "text-orange" : "text-ink";
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("font-display text-[30px] font-semibold leading-none tracking-[-.03em] sm:text-[34px]", color)}>
        {value}
      </span>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

/** Sayfa başlığı — her ekranda aynı ölçü */
export function PageHead({
  eyebrow, title, desc, action,
}: {
  eyebrow?: string; title: string;
  desc?: string; action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <Eyebrow className="mb-2 block">{eyebrow}</Eyebrow>}
        <H1>{title}</H1>
        {desc && <p className="mt-2 text-[14.5px] leading-[1.6] text-muted">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Kart içi başlık */
export function CardHead({
  title, desc, action,
}: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold tracking-[-.01em]">{title}</h2>
        {desc && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ══════════════════════ YATAY KATEGORİ SEÇİCİ ══════════════════════ */

/**
 * SEKME ŞERİDİ
 *
 * Bot ayarlarında 51, AI ayarlarında 40 alan var. Hepsi tek sayfada
 * alt alta dizilirse aranan ayar bulunamıyor; ayrı sayfalara
 * bölünürse "kaydet" düğmesi çoğalıyor ve yarım kaydetme riski
 * doğuyor.
 *
 * Çözüm: tek form, yatay şeritle bölümler. Kaydet tek yerde kalır.
 *
 * Seçili sekme TERS ZEMİN (siyah/beyaz) — panelin tek vurgu rengi.
 */
export function Tabs({
  items, value, onChange, className,
}: {
  items: { key: string; label: string; badge?: number }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "kb-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cn(
              "kb-lift shrink-0 rounded-full px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap",
              "transition-colors duration-200",
              active
                ? "bg-solid text-on-solid"
                : "border border-line bg-surface text-ink2 hover:bg-chip hover:text-ink",
            )}
          >
            {it.label}
            {it.badge ? (
              <span
                className={cn(
                  "kb-num ms-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold",
                  active ? "bg-on-solid/20 text-on-solid" : "bg-chip text-muted",
                )}
              >
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ══════════════════════ SAYAÇ KARTI ══════════════════════ */

/**
 * Gösterge panelindeki sayı kartı.
 *
 * `tone` yalnızca ANLAM taşıdığında verilir: bekleyen iş turuncu,
 * hata kırmızı. Nötr sayılar renksiz kalır — hepsi renkli olursa
 * hiçbiri dikkat çekmez.
 */
export function StatCard({
  label, value, hint, tone, href, icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "green" | "orange" | "danger";
  href?: string;
  icon?: React.ReactNode;
}) {
  const color =
    tone === "orange" ? "text-orange"
    : tone === "danger" ? "text-danger"
    : tone === "green" ? "text-green"
    : "text-ink";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        {icon && <span className="shrink-0 text-muted2">{icon}</span>}
      </div>
      <span className={cn("kb-num mt-2 block text-[30px] font-semibold leading-none", color)}>
        {value}
      </span>
      {hint && <span className="mt-1.5 block text-[12px] text-muted2">{hint}</span>}
    </>
  );

  const base =
    "block rounded-[20px] bg-surface p-4 transition-colors duration-200";

  return href ? (
    <Link href={href} className={cn(base, "hover:bg-chip")}>
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/* ══════════════════════ SAĞLIK GÖSTERGESİ ══════════════════════ */

/**
 * Servis durumu noktası.
 *
 * Üç durum: çalışıyor / uyarı / durdu. "Bilinmiyor" da ayrı bir
 * durum — servis hiç rapor vermediyse yeşil göstermek yanıltıcı
 * olur.
 */
export function HealthDot({
  state, label,
}: {
  state: "ok" | "warn" | "down" | "unknown";
  label?: string;
}) {
  const map = {
    ok:      { bg: "bg-green",  text: "Çalışıyor" },
    warn:    { bg: "bg-orange", text: "Uyarı" },
    down:    { bg: "bg-danger", text: "Durdu" },
    unknown: { bg: "bg-muted2", text: "Bilinmiyor" },
  } as const;
  const m = map[state];

  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink2">
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          m.bg,
          state === "down" && "kb-pulse",
        )}
      />
      {label ?? m.text}
    </span>
  );
}

/* ══════════════════════ TABLO ══════════════════════ */

/**
 * Tablo sarmalayıcı.
 *
 * Dar ekranda yatay kaydırma sağlar. `min-w` VERİLMEZ: sütunlar
 * içeriğe göre daralsın, sabit genişlik dar ekranda gereksiz
 * kaydırma çubuğu çıkarıyordu.
 */
export function TableWrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("kb-scrollbar -mx-1 overflow-x-auto px-1", className)}>
      {children}
    </div>
  );
}

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <table className={cn("w-full border-collapse text-[13.5px]", className)}>
      {children}
    </table>
  );
}

export function Th({
  className, children, align = "start",
}: { className?: string; children?: React.ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <th
      className={cn(
        "border-b border-line px-3 py-2.5 text-[12px] font-semibold tracking-[.02em] text-muted",
        align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  className, children, align = "start", colSpan,
}: {
  className?: string; children?: React.ReactNode;
  align?: "start" | "end" | "center"; colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-line2 px-3 py-3 align-middle",
        align === "end" ? "text-end" : align === "center" ? "text-center" : "text-start",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ══════════════════════ KAYDET ŞERİDİ ══════════════════════ */

/**
 * DEĞİŞİKLİK ŞERİDİ
 *
 * Uzun ayar formlarında kaydet düğmesi sayfanın altında kalıyor ve
 * kullanıcı değişikliği kaydetmeden çıkıyordu. Bu şerit yalnızca
 * kaydedilmemiş değişiklik varken altta belirir.
 *
 * `position:sticky` kullanılıyor, `fixed` değil: sabit konumlandırma
 * mobil klavyeler açıldığında şeridi ekranın ortasında bırakıyor.
 */
export function SaveBar({
  dirty, saving, onSave, onReset, note,
}: {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onReset?: () => void;
  note?: string;
}) {
  if (!dirty) return null;
  return (
    <div className="kb-slide-down sticky bottom-4 z-30 mt-6">
      <div
        className="flex flex-wrap items-center gap-3 rounded-[18px] border border-line bg-page px-4 py-3"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <span className="min-w-0 flex-1 text-[13px] text-ink2">
          {note ?? "Kaydedilmemiş değişiklik var."}
        </span>
        {onReset && (
          <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
            Geri al
          </Button>
        )}
        <Button size="sm" onClick={onSave} loading={saving}>
          Kaydet
        </Button>
      </div>
    </div>
  );
}
