"use client";
import { useState, useMemo } from "react";
import { Card, CardHead, Input, Badge, EmptyState, Tabs } from "@/components/ui";

/* ══════════════════════════════════════════════════════════════
   DENETİM İZİ

   `admin_log` tablosuna her yönetici işlemi yazılıyordu ama
   okuma ekranı yoktu — "kim ne değiştirdi" sorusunun cevabı
   yalnızca SQL bilene açıktı. Görülemeyen denetim izi denetim
   izi değildir.

   ┌─ AYRINTI HAM JSON ⚠️ ─────────────────────────────────────┐
   │ `detail` alanı her işlem türünde farklı şekilli. Her tür   │
   │ için ayrı bir görüntüleyici yazmak yerine ham JSON         │
   │ gösteriliyor — kısa ve okunabilir, ayrıca yeni bir işlem   │
   │ türü eklendiğinde bu ekranı güncellemek gerekmiyor.        │
   │                                                              │
   │ Parolalar buraya ZATEN yazılmıyor (bkz. yama-43).           │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface ActivityRow {
  id: number;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  actor_name: string;
  actor_username: string | null;
  actor_role: string | null;
}

/** Teknik eylem adını okunur Türkçeye çevirir */
const ETIKET: Record<string, string> = {
  user_update: "Kullanıcı güncellendi",
  user_deleted_full: "Kullanıcı silindi",
  user_anonymized: "Kullanıcı anonimleştirildi",
  role_change: "Rol değişti",
  article_approved: "Haber onaylandı",
  article_rejected: "Haber reddedildi",
  comment_moderated: "Yorum denetlendi",
  settings_update: "Site ayarı değişti",
  maintenance_on: "Bakım modu açıldı",
  maintenance_off: "Bakım modu kapatıldı",
  mail_config_update: "Mail ayarı değişti",
  mail_send: "Mail gönderildi",
  mail_reply: "Mail yanıtlandı",
  mail_forward: "Mail iletildi",
  mail_delete: "Mail silindi",
  mail_template_save: "Mail şablonu kaydedildi",
  nav_create: "Menü öğesi eklendi",
  nav_update: "Menü öğesi güncellendi",
  nav_delete: "Menü öğesi silindi",
  nav_reorder: "Menü sırası değişti",
  page_create: "Sayfa oluşturuldu",
  page_update: "Sayfa güncellendi",
  page_delete: "Sayfa silindi",
  ad_create: "Reklam eklendi",
  ad_update: "Reklam güncellendi",
  ad_delete: "Reklam silindi",
  prompt_save: "AI promptu kaydedildi",
  ai_field_create: "AI alanı eklendi",
  ai_field_update: "AI alanı güncellendi",
  ai_field_delete: "AI alanı silindi",
  category_unmap: "Kategori eşleştirmesi kaldırıldı",
  city_unmap: "Şehir eşleştirmesi kaldırıldı",
  remap_articles: "Haberler yeniden eşleştirildi",
  source_update: "Haber kaynağı güncellendi",
  bot_toggle: "Bot açıldı/kapatıldı",
  ai_toggle: "AI açıldı/kapatıldı",
};

/** Tehlikeli işlemler listede öne çıksın */
const TEHLIKELI = new Set([
  "user_deleted_full", "page_delete", "ad_delete", "nav_delete",
  "mail_delete", "ai_field_delete", "maintenance_on",
]);

const GRUPLAR = [
  { k: "hepsi", l: "Hepsi", on: () => true },
  { k: "kullanici", l: "Kullanıcı", on: (a: string) => a.startsWith("user") || a.includes("role") },
  { k: "icerik", l: "İçerik", on: (a: string) => /^(nav|page|ad|article|comment)/.test(a) },
  { k: "mail", l: "Mail", on: (a: string) => a.startsWith("mail") },
  { k: "sistem", l: "Sistem", on: (a: string) => /^(settings|maintenance|bot|ai|prompt|source|remap|category|city)/.test(a) },
];

export default function ActivityPanel({ rows }: { rows: ActivityRow[] }) {
  const [arama, setArama] = useState("");
  const [grup, setGrup] = useState("hepsi");

  const gorunen = useMemo(() => {
    const a = arama.trim().toLowerCase();
    const g = GRUPLAR.find((x) => x.k === grup) ?? GRUPLAR[0];
    return rows.filter((r) =>
      g.on(r.action) &&
      (!a ||
        r.action.toLowerCase().includes(a) ||
        (r.target ?? "").toLowerCase().includes(a) ||
        r.actor_name.toLowerCase().includes(a) ||
        (ETIKET[r.action] ?? "").toLowerCase().includes(a)),
    );
  }, [rows, arama, grup]);

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={grup}
        onChange={setGrup}
        items={GRUPLAR.map((g) => ({
          key: g.k, label: g.l,
          badge: g.k === "hepsi" ? rows.length : rows.filter((r) => g.on(r.action)).length || undefined,
        }))}
      />

      <Input
        value={arama}
        onChange={(e) => setArama(e.target.value)}
        placeholder="Eylem, hedef ya da kişi ara"
      />

      <Card className="p-5">
        <CardHead
          title={`${gorunen.length} kayıt`}
          desc="En yeni 200 işlem. Kayıtlar silinemez."
        />

        {gorunen.length === 0 ? (
          <EmptyState title="Kayıt yok"
            description={arama ? "Farklı bir arama dene." : "Henüz işlem yapılmamış."} />
        ) : (
          <ul className="flex flex-col">
            {gorunen.map((r, i) => {
              const ayrinti = r.detail && Object.keys(r.detail).length
                ? JSON.stringify(r.detail)
                : null;
              return (
                <li key={r.id}
                  className={`flex flex-wrap items-start gap-3 py-3 ${i > 0 ? "border-t border-line2" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold">
                        {ETIKET[r.action] ?? r.action}
                      </span>
                      {TEHLIKELI.has(r.action) && <Badge tone="danger">Kritik</Badge>}
                      {r.target && (
                        <code className="max-w-[280px] truncate rounded bg-chip px-1.5 py-0.5 text-[12px]">
                          {r.target}
                        </code>
                      )}
                    </span>
                    {ayrinti && (
                      <span className="mt-1 block truncate font-mono text-[11.5px] text-muted2"
                        title={ayrinti}>
                        {ayrinti.slice(0, 160)}
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 text-end">
                    <span className="block text-[12.5px] font-medium">{r.actor_name}</span>
                    <span className="kb-num block text-[11.5px] text-muted2">
                      {new Date(r.created_at).toLocaleString("tr-TR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
