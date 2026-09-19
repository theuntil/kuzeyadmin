"use client";
import { useState } from "react";
import AyarPenceresi from "./AyarPenceresi";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Card, CardHead, H3, Eyebrow, Badge, Switch, Input, Select, SettingRow } from "@/components/ui";
import Icon, { type IconName } from "@/components/ui/Icon";
import { n, dt } from "@/lib/utils";
import KaliteSecici, { kaliteBul, type KaliteSecenek } from "./KaliteSecici";

export interface BotSettings {
  is_enabled: boolean; pause_reason: string | null;
  poll_interval_sec: number; request_timeout_sec: number;
  feed_max_retries: number; feed_retry_backoff_ms: number; feed_user_agent: string;
  ingest_enabled: boolean; max_items_per_run: number; backfill_lookback_min: number;
  media_enabled: boolean; media_concurrency: number; media_max_attempts: number;
  media_rate_per_sec: number; media_download_timeout_sec: number;
  image_enabled: boolean; image_format: string; image_quality: number;
  image_fallback_webp: boolean; image_max_bytes: number; image_blurhash: boolean;
  video_enabled: boolean; video_concurrency: number; video_max_height: number;
  video_crf_short: number; video_crf_long: number; video_preset: string;
  video_audio_kbps: number; video_threads: number;
  video_short_max_sec: number; video_skip_over_sec: number; video_max_bytes: number;
  alerts_enabled: boolean; alert_email: string | null;
  alert_min_consecutive: number; alert_cooldown_min: number;
  alert_on_recovery: boolean; alert_critical_bypass: boolean; alert_daily_cap: number;
  watchdog_enabled: boolean; watchdog_stale_min: number;
  last_run_at: string | null; last_success_at: string | null;
  consecutive_errors: number; total_runs: number; total_articles: number;
}

type GroupId = "genel" | "feed" | "medya" | "gorsel" | "video" | "bildirim";

const GROUPS: { id: GroupId; title: string; icon: IconName; note?: string }[] = [
  { id: "genel", title: "Genel", icon: "system", note: "Botu aç/kapat ve genel işleme kuralları." },
  { id: "feed", title: "Feed", icon: "refresh", note: "İHA akışı ne sıklıkla ve nasıl çekilsin." },
  { id: "medya", title: "Medya", icon: "media", note: "Fotoğraf ve video indirme kuralları." },
  { id: "gorsel", title: "Görsel", icon: "camera", note: "Görsel sıkıştırma ve boyutlar." },
  { id: "video", title: "Video", icon: "media", note: "Video dönüştürme kalitesi." },
  { id: "bildirim", title: "Bildirim", icon: "mail", note: "Hata ve izleyici uyarıları." },
];

/**
 * BOT AYARLARI — GERÇEK ÇALIŞMA ZAMANI AYARLARI
 *
 * `bot_settings` tablosunun TÜM alanları burada; eskiden yalnızca
 * açma/kapama ve e-posta değiştirilebiliyordu, geri kalan 50+ alan
 * yalnızca ortam değişkeniyle değiştirilebiliyordu.
 *
 * Yatay kategori seçici + tek kart: hepsi alt alta uzun bir liste
 * olsaydı aradığını bulmak sayfayı taramayı gerektirirdi.
 */
export default function BotSettingsPanel({ initial }: { initial: BotSettings }) {
  const [s, setS] = useState(initial);
  const [group, setGroup] = useState<GroupId>("genel");
  const [busy, setBusy] = useState<string | null>(null);

  /* Açık sayı düzenleme penceresi — null ise kapalı */
  const [duzenle, setDuzenle] = useState<{
    key: keyof BotSettings;
    label: string;
    aciklama?: string;
    min?: number; max?: number; step?: number; birim?: string;
  } | null>(null);

  /* Açık metin düzenleme penceresi */
  const [metinDuzenle, setMetinDuzenle] = useState<{
    key: keyof BotSettings; label: string; aciklama?: string;
  } | null>(null);
  const t = useToast();

  async function save<K extends keyof BotSettings>(key: K, value: BotSettings[K]) {
    const prev = s[key];
    setS((p) => ({ ...p, [key]: value }));
    setBusy(String(key));
    const { error } = await supabaseBrowser().rpc("admin_update_bot", { p_patch: { [key]: value } });
    setBusy(null);
    if (error) { setS((p) => ({ ...p, [key]: prev })); t.error(error.message); return; }
    t.success("Kaydedildi");
  }

  /**
   * Hazır kalite ayarını uygular — sekiz alanı tek istekte.
   *
   * ⚠ TEK İSTEK, SEKİZ AYRI İSTEK DEĞİL.
   * Alanları tek tek kaydetseydik biri hata verdiğinde ayarlar
   * yarı uygulanmış kalırdı; video 1080p ama ses 64 kbps gibi
   * tutarsız bir durum oluşurdu.
   */
  async function kaliteUygula(q: KaliteSecenek) {
    setBusy("kalite");
    const { error } = await supabaseBrowser().rpc("admin_update_bot", {
      p_patch: q.degerler,
    });
    setBusy(null);

    if (error) { t.error(error.message); return; }
    setS((p2) => ({ ...p2, ...q.degerler }));
    t.success(`${q.ad} kalite ayarı uygulandı`);
  }

  const sw = (key: keyof BotSettings, label: string, desc?: string, first?: boolean) => (
    <SettingRow label={label} desc={desc} first={first}>
      <Switch checked={Boolean(s[key])} disabled={busy === key} label={label}
              onChange={(v) => save(key, v as BotSettings[typeof key])} />
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
    key: keyof BotSettings, label: string, desc?: string,
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

  const txt = (key: keyof BotSettings, label: string, desc?: string) => (
    <SettingRow label={label} desc={desc}>
      <button
        type="button"
        onClick={() => setMetinDuzenle({ key, label, aciklama: desc })}
        disabled={busy === key}
        className="max-w-[48vw] truncate rounded-xl border border-line bg-surface2 px-3.5 py-2 text-start text-[14px] disabled:opacity-50"
        style={{ minWidth: 220 }}
        title={String(s[key] ?? "")}
      >
        {String(s[key] ?? "").trim() || (
          <span className="text-muted2">Boş — eklemek için tıkla</span>
        )}
      </button>
    </SettingRow>
  );

  const stale = s.last_run_at
    ? Date.now() - new Date(s.last_run_at).getTime() > s.watchdog_stale_min * 60_000
    : false;

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
            await save(duzenle.key, Number(v) as BotSettings[typeof duzenle.key]);
          }}
        />
      )}
      {metinDuzenle && (
        <AyarPenceresi
          acik
          onKapat={() => setMetinDuzenle(null)}
          baslik={metinDuzenle.label}
          aciklama={metinDuzenle.aciklama}
          tur="metin"
          deger={String(s[metinDuzenle.key] ?? "")}
          onKaydet={async (v: string | number) => {
            await save(metinDuzenle.key, String(v) as BotSettings[typeof metinDuzenle.key]);
          }}
        />
      )}
    <div className="flex flex-col gap-7">
      {/* ---- durum kartları ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Durum", value: s.is_enabled ? "Çalışıyor" : "Durduruldu",
            tone: s.is_enabled ? "green" as const : "muted" as const },
          { label: "Son çalışma", value: dt(s.last_run_at) },
          { label: "Toplam haber", value: n(s.total_articles) },
          { label: "Ardışık hata", value: n(s.consecutive_errors),
            tone: s.consecutive_errors > 0 ? "danger" as const : "muted" as const },
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

      {stale && s.is_enabled && (
        <div className="rounded-[16px] bg-danger-soft px-4 py-3.5 text-[13.5px] font-medium text-danger">
          Bot {s.watchdog_stale_min} dakikadır çalışmadı görünüyor. Servisin ayakta olup
          olmadığını Dokploy'dan kontrol et.
        </div>
      )}

      {/* ---- yatay kategori seçici ---- */}
      <div className="ct-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {GROUPS.map((g) => {
          const active = group === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              aria-pressed={active}
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

      {/* ---- aktif grup ---- */}
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

          {group === "genel" && (
            <>
              {sw("is_enabled", "Bot çalışıyor", "Kapatınca yeni haber çekilmez.", true)}
              {sw("ingest_enabled", "Haber işleme", "Kapatınca feed okunur ama haber kaydedilmez.")}
              {num("max_items_per_run", "Tur başına en fazla haber", undefined, { min: 1, max: 1000 })}
              {num("backfill_lookback_min", "Geriye dönük tarama", "Kaçırılan haberi yakalamak için.", { min: 0, suffix: "dakika" })}
              {txt("pause_reason", "Duraklatma notu", "Bot kapalıyken neden kapalı olduğunu hatırlatır.")}
            </>
          )}

          {group === "feed" && (
            <>
              {num("poll_interval_sec", "Kontrol aralığı", "İHA en az 30 sn ister, altına inilemez.", { min: 30, suffix: "saniye" }, )}
              {num("request_timeout_sec", "İstek zaman aşımı", undefined, { min: 5, suffix: "saniye" })}
              {num("feed_max_retries", "En fazla yeniden deneme", undefined, { min: 0, max: 10 })}
              {num("feed_retry_backoff_ms", "Yeniden deneme beklemesi", undefined, { min: 0, suffix: "ms" })}
              {txt("feed_user_agent", "User-Agent")}
            </>
          )}

          {group === "medya" && (
            <>
              {sw("media_enabled", "Medya indirme", "Kapatınca yalnızca metin kaydedilir.", true)}
              {num("media_concurrency", "Aynı anda indirme", undefined, { min: 1, max: 16 })}
              {num("media_max_attempts", "En fazla deneme", undefined, { min: 1, max: 20 })}
              {num("media_rate_per_sec", "Saniyede istek", undefined, { min: 0.1, step: 0.1 })}
              {num("media_download_timeout_sec", "İndirme zaman aşımı", undefined, { min: 5, suffix: "saniye" })}
            </>
          )}

          {group === "gorsel" && (
            <>
              {sw("image_enabled", "Görsel işleme", undefined, true)}
              <SettingRow label="Biçim">
                <Select value={s.image_format} disabled={busy === "image_format"}
                        onChange={(e) => save("image_format", e.target.value)}
                        className="h-9 w-[120px]">
                  <option value="avif">AVIF</option>
                  <option value="webp">WebP</option>
                  <option value="jpeg">JPEG</option>
                </Select>
              </SettingRow>
              {num("image_quality", "Görsel netliği", "70 çoğu haber görseli için yeterli. Yükseldikçe dosya büyür.", { min: 20, max: 95 })}
              {sw("image_fallback_webp", "AVIF desteklenmezse WebP'ye düş")}
              {sw("image_blurhash", "Bulanık önizleme (blurhash)")}
              {num("image_max_bytes", "En büyük görsel dosyası", "Bundan büyük görseller indirilmez. 10485760 = 10 MB.", { min: 65536, suffix: "bayt" })}
            </>
          )}

          {group === "video" && (
            <>
              {sw("video_enabled", "Video işleme", undefined, true)}

              {/*
                ⚠ HAZIR AYARLAR ÖNCE GELİYOR.
                Altındaki teknik alanlar ffmpeg terimleri
                (CRF, preset, bit hızı); ne yaptığını bilmeden
                dokunmak videoyu bozabiliyor ya da sunucuyu
                kilitleyebiliyor. Çoğu kullanıcı için bir kart
                seçmek yeterli.
              */}
              <KaliteSecici
                secili={kaliteBul(s)}
                busy={busy !== null}
                onSec={(q) => void kaliteUygula(q)}
              />
              {num("video_concurrency", "Aynı anda kaç video işlensin", "Yüksek değer sunucuyu zorlayabilir.", { min: 1, max: 4 })}
              {num("video_max_height", "Video çözünürlüğü", "720 = HD, 1080 = Full HD. Yalnızca 360, 480, 720 veya 1080 girilebilir.", { min: 360, max: 1080, suffix: "px" })}
              {num("video_crf_short", "Kısa videoların netliği", "18 en net, 35 en bulanık. Netlik arttıkça dosya büyür.", { min: 18, max: 35 })}
              {num("video_crf_long", "Uzun videoların netliği", "Uzun videolar daha çok yer kapladığı için genelde biraz daha yüksek tutulur.", { min: 18, max: 35 })}
              <SettingRow label="Hız/kalite dengesi">
                <Select value={s.video_preset} disabled={busy === "video_preset"}
                        onChange={(e) => save("video_preset", e.target.value)}
                        className="h-9 w-[140px]">
                  {/*
                    ⚠ SEÇENEKLER KISITLA AYNI.
                    chk_vpreset yalnızca bu yedi değeri kabul
                    ediyor; listede olmayan bir değer kaydederken
                    hata veriyordu.
                  */}
                  {[
                    { v: "ultrafast", ad: "En hızlı — en büyük dosya" },
                    { v: "superfast", ad: "Çok hızlı" },
                    { v: "veryfast", ad: "Hızlı" },
                    { v: "faster", ad: "Hızlıca" },
                    { v: "fast", ad: "Dengeli" },
                    { v: "medium", ad: "Yavaş — daha küçük dosya" },
                    { v: "slow", ad: "En yavaş — en küçük dosya" },
                  ].map((x) => <option key={x.v} value={x.v}>{x.ad}</option>)}
                </Select>
              </SettingRow>
              {num("video_audio_kbps", "Ses kalitesi", "64 konuşma için yeterli, 128 müzikli videolarda daha iyi.", { min: 32, max: 320, suffix: "kbps" })}
              {num("video_threads", "Aynı anda kullanılacak işlemci gücü", "Yüksek değer videoyu hızlı işler ama sunucuyu yorar.", { min: 1, max: 8 })}
              {num("video_short_max_sec", "Kaç saniyeye kadar \"kısa video\" sayılsın", "Bu süreden kısa videolara üstteki kısa video netliği uygulanır.", { min: 10, max: 600, suffix: "saniye" })}
              {num("video_skip_over_sec", "Çok uzun videoları hiç işleme", "Bu süreyi aşan videolar dönüştürülmez, yalnızca kapak görseli alınır. 3600 = 1 saat.", { min: 60, max: 14400, suffix: "saniye" })}
              {num("video_max_bytes", "En büyük video dosyası", "Bundan büyük videolar indirilmez. 104857600 = 100 MB.", { min: 1048576, suffix: "bayt" })}
            </>
          )}

          {group === "bildirim" && (
            <>
              {sw("alerts_enabled", "Hata bildirimleri", undefined, true)}
              {txt("alert_email", "Bildirim e-postası")}
              {num("alert_min_consecutive", "Kaç ardışık hatadan sonra", undefined, { min: 1, max: 20 })}
              {num("alert_cooldown_min", "Aynı hata için bekleme", undefined, { min: 0, suffix: "dakika" })}
              {sw("alert_on_recovery", "Düzelince de haber ver")}
              {sw("alert_critical_bypass", "Kritik hatada bekleme atla")}
              {num("alert_daily_cap", "Günlük en fazla bildirim", undefined, { min: 1, max: 500 })}
              <div className="mt-1 border-t border-line2 pt-4">
                <Eyebrow className="mb-3 block">İzleyici</Eyebrow>
                {sw("watchdog_enabled", "İzleyici açık", "Bot uzun süre çalışmazsa uyarır.", true)}
                {num("watchdog_stale_min", "Bu süre sonra uyar", undefined, { min: 5, suffix: "dakika" })}
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
    </>
  );
}
