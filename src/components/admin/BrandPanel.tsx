"use client";
import { useState, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle, r2Vazgec } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHead } from "@/components/ui";
import Icon from "@/components/ui/Icon";

export interface Brand {
  logo_light_key: string | null;
  logo_dark_key: string | null;
  favicon_key: string | null;
  /** Koyu tema faviconu — boşsa `favicon_key` her ikisinde kullanılır */
  favicon_dark_key: string | null;
  og_image_key: string | null;
  /** Mağaza rozetleri — haber sayfasındaki uygulama düğmeleri */
  app_store_badge_key: string | null;
  play_store_badge_key: string | null;
  /** Görseli olmayan haberlerde kullanılan varsayılan görsel */
  placeholder_key: string | null;
  placeholder_dark_key: string | null;
}

const SLOTS = [
  { key: "logo_light_key", label: "Açık tema logosu",
    desc: "Beyaz zeminde kullanılır. Yatay, şeffaf PNG ya da SVG.", dark: false },
  { key: "logo_dark_key", label: "Koyu tema logosu",
    desc: "Koyu zeminde ve bu panelin menüsünde kullanılır.", dark: true },
  { key: "favicon_key", label: "Favicon",
    desc: "Sekme simgesi. Kare, en az 180×180. Site ve panelde görünür.", dark: false },
  { key: "favicon_dark_key", label: "Favicon · koyu tema",
    desc: "İsteğe bağlı. Boşsa üstteki her iki temada kullanılır.", dark: true },
  { key: "app_store_badge_key", label: "App Store rozeti",
    desc: "Apple'ın resmî rozeti. Boşsa sade bir düğme gösterilir.", dark: false },
  { key: "play_store_badge_key", label: "Google Play rozeti",
    desc: "Google'ın resmî rozeti. Boşsa sade bir düğme gösterilir.", dark: false },
  { key: "placeholder_key", label: "Varsayılan görsel",
    desc: "Fotoğrafı olmayan haberlerde kullanılır. 16:9 önerilir.", dark: false },
  { key: "placeholder_dark_key", label: "Varsayılan görsel · koyu tema",
    desc: "İsteğe bağlı. Boşsa üstteki her iki temada kullanılır.", dark: true },
  { key: "og_image_key", label: "Paylaşım görseli",
    desc: "Sosyal medyada bağlantı paylaşılınca görünür. 1200×630.", dark: false },
] as const;

/**
 * LOGO VE GÖRÜNÜM
 *
 * Yüklenen görseller `library` kovasına gider, anahtarı
 * `site_settings`e yazılır. SİTE VE PANEL AYNI KAYNAKTAN OKUR;
 * kodda sabit logo yolu yok. Logoyu buradan değiştirince her
 * yerde değişir.
 */
export default function BrandPanel({
  initial, cdnBase,
}: {
  initial: Brand;
  cdnBase: string;
}) {
  const [brand, setBrand] = useState<Brand>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const t = useToast();

  const url = (k: string | null) =>
    k ? `${cdnBase.replace(/\/+$/, "")}/${k}` : null;

  async function upload(slot: keyof Brand, file: File) {
    if (!file.type.startsWith("image/")) { t.error("Yalnızca görsel yüklenebilir"); return; }
    if (file.size > 5 * 1024 * 1024) { t.error("Dosya 5 MB'den büyük"); return; }

    setBusy(slot);

    // R2'ye doğrudan; anahtar `library/...` sunucuda üretilir
    let key: string;
    try {
      ({ key } = await r2Yukle(file, "library", `${slot}-${file.name}`));
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Yüklenemedi");
      setBusy(null); return;
    }

    const sb = supabaseBrowser();
    const { error } = await sb.rpc("admin_update_settings", {
      p_patch: { [slot]: key },
    });
    setBusy(null);

    if (error) {
      await r2Vazgec(key);   // ayar kaydedilmediyse dosya yetim kalmasın
      t.error(error.message); return;
    }
    setBrand((p) => ({ ...p, [slot]: key }));
    t.success("Görsel güncellendi");
  }

  async function clear(slot: keyof Brand) {
    setBusy(slot);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("admin_update_settings", {
      p_patch: { [slot]: "" },
    });
    setBusy(null);
    if (error) { t.error(error.message); return; }
    setBrand((p) => ({ ...p, [slot]: null }));
  }

  return (
    <Card className="p-5">
      <CardHead
        title="Logo ve görseller"
        desc="Buraya yüklediklerin sitede ve bu panelde kullanılır. Kodda sabit logo yok."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SLOTS.map((s) => {
          const src = url(brand[s.key]);
          return (
            <div key={s.key} className="rounded-[12px] border border-line p-4">
              <div className="mb-1 text-[13px] font-semibold">{s.label}</div>
              <p className="mb-3 text-[12px] leading-relaxed text-muted">{s.desc}</p>

              <button
                onClick={() => refs.current[s.key]?.click()}
                disabled={busy === s.key}
                className="relative grid h-[92px] w-full place-items-center overflow-hidden rounded-[10px] border border-dashed border-line transition-colors hover:border-muted"
                style={{ background: s.dark ? "var(--deep)" : "var(--field)" }}
              >
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={src} alt="" className="max-h-[64px] max-w-[80%] object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-1.5 text-muted">
                    <Icon name="media" size={20} />
                    <span className="text-[12px] font-medium">Görsel seç</span>
                  </span>
                )}
              </button>

              <input
                ref={(el) => { refs.current[s.key] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(s.key, f);
                }}
              />

              {src && (
                <div className="mt-2.5 flex gap-2">
                  <Button size="sm" onClick={() => refs.current[s.key]?.click()}>
                    Değiştir
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => clear(s.key)}>
                    Kaldır
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
