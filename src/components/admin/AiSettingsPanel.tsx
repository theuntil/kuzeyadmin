"use client";
import { useState } from "react";
import AyarPenceresi from "./AyarPenceresi";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Card, CardHead, H3, Eyebrow, Badge, Switch, Input, Select, SettingRow } from "@/components/ui";
import Icon, { type IconName } from "@/components/ui/Icon";
import { n, dt } from "@/lib/utils";

export interface AiSettings {
  is_enabled: boolean;
  analiz_enabled: boolean; ceviri_enabled: boolean; ozet_enabled: boolean;
  instagram_enabled: boolean; guvenlik_enabled: boolean; onem_enabled: boolean;
  analiz_model: string; ceviri_model: string;
  temperature: number; max_output_tokens: number;
  diller: string[]; ceviri_govde: boolean; ceviri_min_onem: number;
  gunluk_butce_usd: number; gunluk_max_haber: number;
  max_attempts: number; retry_backoff_sec: number;
  request_timeout_sec: number; concurrency: number;
  poll_bos_sn: number | null; poll_dolu_sn: number | null; parti_boyutu: number | null;
}

/**
 * ⚠ ALAN ADLARI `ai_health` GÖRÜNÜMÜYLE BİREBİR OLMALI.
 *
 * Eskiden `spent_today_usd` ve `total_processed` yazıyordu ama
 * görünümde `bugun_harcanan` ve `analiz_edilen` var. Alan
 * `undefined` geliyor ve `.toFixed()` sayfayı çökertiyordu:
 *   TypeError: Cannot read properties of undefined (reading 'toFixed')
 *
 * Hepsi isteğe bağlı işaretlendi: görünüme yeni kolon eklenip
 * eskisi kaldırılsa bile panel çökmesin, boş göstersin.
 */
export interface AiHealth {
  last_run_at?: string | null;
  bugun_harcanan?: number | null;
  bugun_cagri?: number | null;
  bugun_hata?: number | null;
  toplam_harcanan?: number | null;
  analiz_edilen?: number | null;
  bekleyen?: number | null;
  basarisiz?: number | null;
  dakika_once?: number | null;
}

/** Sayıya çevir; null/undefined/metin gelirse 0 */
const say = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3-mini"];
const ALL_LANGS = [
  { code: "en", label: "İngilizce" }, { code: "ar", label: "Arapça" },
  { code: "ru", label: "Rusça" }, { code: "de", label: "Almanca" },
  { code: "fr", label: "Fransızca" },
];

type GroupId = "genel" | "ozellik" | "model" | "ceviri" | "butce" | "performans";

const GROUPS: { id: GroupId; title: string; icon: IconName; note?: string }[] = [
  { id: "genel", title: "Genel", icon: "system", note: "AI servisini aç/kapat." },
  { id: "ozellik", title: "Özellikler", icon: "check", note: "Hangi analizler çalışsın." },
  { id: "model", title: "Model", icon: "dashboard", note: "Hangi model, ne kadar yaratıcı." },
  { id: "ceviri", title: "Çeviri", icon: "media", note: "Hangi dillere, hangi eşikte." },
  { id: "butce", title: "Bütçe", icon: "mail", note: "Günlük harcama ve haber sınırı." },
  { id: "performans", title: "Performans", icon: "refresh", note: "Yeniden deneme ve eşzamanlılık." },
];

/**
 * AI AYARLARI — GERÇEK ÇALIŞMA ZAMANI AYARLARI
 *
 * `ai_settings`in tüm alanları. Eskiden yalnızca açma/kapama
 * vardı; model seçimi, sıcaklık, çeviri dilleri, günlük bütçe
 * gibi asıl karar verilen ayarlar ortam değişkeninde kilitliydi.
 */
export default function AiSettingsPanel({
  initial, health,
}: { initial: AiSettings; health: AiHealth | null }) {
  const [s, setS] = useState(initial);
  const [group, setGroup] = useState<GroupId>("genel");
  const [busy, setBusy] = useState<string | null>(null);

  /* Açık sayı düzenleme penceresi — null ise kapalı */
  const [duzenle, setDuzenle] = useState<{
    key: keyof AiSettings;
    label: string;
    aciklama?: string;
    min?: number; max?: number; step?: number; birim?: string;
  } | null>(null);
  const t = useToast();

  async function save<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    const prev = s[key];
    setS((p) => ({ ...p, [key]: value }));
    setBusy(String(key));
    const { error } = await supabaseBrowser().rpc("admin_update_ai", { p_patch: { [key]: value } });
    setBusy(null);
    if (error) { setS((p) => ({ ...p, [key]: prev })); t.error(error.message); return; }
    t.success("Kaydedildi");
  }

  const sw = (key: keyof AiSettings, label: string, desc?: string, first?: boolean) => (
    <SettingRow label={label} desc={desc} first={first}>
      <Switch checked={Boolean(s[key])} disabled={busy === key} label={label}
              onChange={(v) => save(key, v as AiSettings[typeof key])} />
    </SettingRow>
  );

  /*
   * ⚠ ANINDA KAYDETME KALDIRILDI.
   *
   * Alanlar `onBlur` ile kaydediliyordu: yanlışlıkla bir rakama
   * dokunup başka yere tıklamak canlı yapılandırmayı
   * değiştiriyordu ve vazgeçme imkânı yoktu. Ayrıca sınır
   * dışı bir değer doğrudan veritabanı kısıtına çarpıp
   * anlaşılmaz hata veriyordu.
   *
   * Artık değere tıklayınca pencere açılıyor; sınır orada
   * denetleniyor ve `Kaydet` ile onaylanıyor.
   */
  const num = (
    key: keyof AiSettings, label: string, desc?: string,
    opts?: { min?: number; max?: number; step?: number; suffix?: string },
  ) => (
    <SettingRow label={label} desc={desc}>
      <button
        type="button"
        onClick={() => setDuzenle({
          key, label, aciklama: desc,
          min: opts?.min, max: opts?.max, step: opts?.step, birim: opts?.suffix,
        })}
        disabled={busy === key}
        className="min-w-[100px] rounded-xl border border-line bg-surface2 px-3.5 py-2 text-[14px] font-semibold tabular-nums disabled:opacity-50"
      >
        {String(s[key] ?? "—")}{opts?.suffix ? ` ${opts.suffix}` : ""}
      </button>
    </SettingRow>
  );

  function toggleLang(code: string) {
    const next = s.diller.includes(code)
      ? s.diller.filter((x) => x !== code)
      : [...s.diller, code];
    save("diller", next);
  }

  const harcanan = say(health?.bugun_harcanan);
  const butce = Math.max(say(s.gunluk_butce_usd), 0.01);
  const dailyPct = Math.min(100, (harcanan / butce) * 100);

  return (
    <>
      {duzenle && (
        <AyarPenceresi
          acik
          onKapat={() => setDuzenle(null)}
          baslik={duzenle.label}
          aciklama={duzenle.aciklama}
          tur="sayi"
          deger={(s[duzenle.key] as number) ?? 0}
          min={duzenle.min}
          max={duzenle.max}
          step={duzenle.step}
          birim={duzenle.birim}
          onKaydet={async (v: string | number) => {
            await save(duzenle.key, Number(v) as AiSettings[typeof duzenle.key]);
          }}
        />
      )}
    <div className="flex flex-col gap-7">
      {/* ---- durum kartları ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Durum", value: s.is_enabled ? "Çalışıyor" : "Durduruldu",
            tone: s.is_enabled ? "green" as const : "muted" as const },
          { label: "Son çalışma", value: dt(health?.last_run_at ?? null) },
          { label: "Bugün işlenen", value: n(say(health?.analiz_edilen)) },
          { label: "Bugünkü harcama", value: `$${harcanan.toFixed(2)}` },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-[11.5px] font-semibold text-muted">{c.label}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[16px] font-bold">{c.value}</span>
              {c.tone && <Badge tone={c.tone}>•</Badge>}
            </div>
          </Card>
        ))}
      </div>

      {health && say(s.gunluk_butce_usd) > 0 && (
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <span className="font-semibold">Günlük bütçe kullanımı</span>
            <span className="text-muted">
              ${harcanan.toFixed(2)} / ${say(s.gunluk_butce_usd).toFixed(2)}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-chip">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${dailyPct >= 90 ? "bg-danger" : "bg-solid"}`}
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </Card>
      )}

      {/* ---- yatay kategori seçici ---- */}
      <div className="ct-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {GROUPS.map((g) => {
          const active = group === g.id;
          return (
            <button key={g.id} onClick={() => setGroup(g.id)} aria-pressed={active}
              className={`flex w-[104px] shrink-0 flex-col items-center gap-2.5 rounded-[16px] border px-3 py-4 transition-colors sm:w-[112px] ${
                active ? "border-solid bg-solid text-on-solid"
                       : "border-line bg-surface text-ink2 hover:border-ink/25 hover:text-ink"
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${active ? "bg-on-solid/15" : "bg-chip"}`}>
                <Icon name={g.icon} size={18} />
              </span>
              <span className="text-center text-[12px] font-semibold leading-tight">{g.title}</span>
            </button>
          );
        })}
      </div>

      {GROUPS.filter((g) => g.id === group).map((g) => (
        <Card key={g.id} className="flex flex-col gap-1 p-6 sm:p-7">
          <div className="mb-2 flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-solid text-on-solid">
              <Icon name={g.icon} size={20} />
            </span>
            <div>
              <H3 className="text-[18px]">{g.title}</H3>
              {g.note && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{g.note}</p>}
            </div>
          </div>

          {group === "genel" && sw("is_enabled", "AI servisi çalışıyor", "Kapatınca yeni haberler işlenmez.", true)}

          {group === "ozellik" && (
            <>
              {sw("ozet_enabled", "Özet üretimi", undefined, true)}
              {sw("analiz_enabled", "İçerik analizi")}
              {sw("onem_enabled", "Önem puanı", "Manşet sıralamasında kullanılır.")}
              {sw("guvenlik_enabled", "Güvenlik denetimi", "Çocuk güvenliği ve hassas içerik taraması.")}
              {sw("ceviri_enabled", "Çeviri")}
              {sw("instagram_enabled", "Instagram metni üretimi")}
            </>
          )}

          {group === "model" && (
            <>
              <SettingRow label="Analiz modeli" first>
                <Select value={s.analiz_model} disabled={busy === "analiz_model"}
                        onChange={(e) => save("analiz_model", e.target.value)} className="h-9 w-[160px]">
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </SettingRow>
              <SettingRow label="Çeviri modeli">
                <Select value={s.ceviri_model} disabled={busy === "ceviri_model"}
                        onChange={(e) => save("ceviri_model", e.target.value)} className="h-9 w-[160px]">
                  {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </Select>
              </SettingRow>
              {num("temperature", "Sıcaklık", "0 = tutarlı, 1 = yaratıcı.", { min: 0, max: 1, step: 0.1 })}
              {num("max_output_tokens", "En fazla çıktı", undefined, { min: 100, suffix: "token" })}
            </>
          )}

          {group === "ceviri" && (
            <>
              <SettingRow label="Diller" first>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {ALL_LANGS.map((l) => (
                    <button key={l.code} onClick={() => toggleLang(l.code)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        s.diller.includes(l.code) ? "bg-solid text-on-solid" : "bg-chip text-ink2"
                      }`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </SettingRow>
              {sw("ceviri_govde", "Haber gövdesini de çevir", "Kapalıysa yalnızca başlık çevrilir.")}
              {num("ceviri_min_onem", "En düşük önem puanı", "Bu puanın altındaki haberler çevrilmez.", { min: 0, max: 10 })}
            </>
          )}

          {group === "butce" && (
            <>
              {num("gunluk_butce_usd", "Günlük bütçe", undefined, { min: 0, step: 0.5, suffix: "USD" })}
              {num("gunluk_max_haber", "Günlük en fazla haber", undefined, { min: 0 })}
            </>
          )}

          {group === "performans" && (
            <>
              {num("max_attempts", "En fazla deneme", undefined, { min: 1, max: 10 })}
              {num("retry_backoff_sec", "Yeniden deneme beklemesi", undefined, { min: 1, suffix: "saniye" })}
              {num("request_timeout_sec", "İstek zaman aşımı", undefined, { min: 5, suffix: "saniye" })}
              {num("concurrency", "Eşzamanlı işlem", undefined, { min: 1, max: 20 })}
              <div className="mt-1 border-t border-line2 pt-4">
                <Eyebrow className="mb-3 block">Yoklama sıklığı</Eyebrow>
                {num("poll_bos_sn", "Kuyruk boşken bekleme", undefined, { min: 1, suffix: "saniye" })}
                {num("poll_dolu_sn", "Kuyruk doluyken bekleme", undefined, { min: 0, suffix: "saniye" })}
                {num("parti_boyutu", "Parti boyutu", undefined, { min: 1 })}
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
    </>
  );
}
