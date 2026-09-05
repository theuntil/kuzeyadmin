"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import {
  Button, Card, CardHead, Field, Input, Select, Switch,
  Alert, Divider, SaveBar,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   MAİL AYARLARI

   Tek sayfa, dört kart: servis · SMTP · IMAP · şablon görseli.

   ┌─ SORULMAYAN ALANLAR ⚠️ ───────────────────────────────────┐
   │ Gönderen adresi, yanıt adresi, klasör adları ve marka       │
   │ bilgileri kaldırıldı:                                        │
   │   • Gönderen adresi = SMTP kullanıcısı. Farklı olursa çoğu  │
   │     sunucu "553 Sender address rejected" veriyor; ayrı alan │
   │     tutmak yalnızca hata üretiyordu.                         │
   │   • Klasörler varsayılanla çalışıyor (INBOX/Sent/Trash);    │
   │     yanlış girilen bir ad senkronu sessizce durduruyordu.   │
   │   • Marka adı ve logo Görünüm ayarlarından geliyor.         │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface MailPreset {
  slug: string; label: string;
  smtp_host: string; smtp_port: number; smtp_secure: boolean;
  imap_host?: string | null; imap_port?: number | null;
}

export interface MailConfig {
  is_enabled: boolean;
  from_name: string | null;
  from_email: string | null;
  batch_size: number;
  daily_limit: number;
  send_verification: boolean;
  send_welcome: boolean;
  send_newsletter: boolean;

  smtp_host: string | null;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string | null;
  has_smtp_pass: boolean;
  smtp_hazir: boolean;

  imap_enabled: boolean;
  imap_host: string | null;
  imap_port: number;
  imap_secure: boolean;
  imap_user: string | null;
  has_imap_pass: boolean;
  imap_folder: string;

  hero_image_key: string | null;
  imap_last_sync: string | null;
  imap_last_error: string | null;
  sync_url: string | null;
}

const BOS: MailConfig = {
  is_enabled: false, from_name: null, from_email: null,
  batch_size: 10, daily_limit: 500,
  send_verification: true, send_welcome: true, send_newsletter: true,
  smtp_host: null, smtp_port: 587, smtp_secure: false, smtp_user: null,
  has_smtp_pass: false, smtp_hazir: false,
  imap_enabled: false, imap_host: null, imap_port: 993, imap_secure: true,
  imap_user: null, has_imap_pass: false, imap_folder: "INBOX",
  hero_image_key: null, imap_last_sync: null, imap_last_error: null,
  sync_url: null,
};

export default function MailSettingsPanel({
  initial, cdnBase,
}: {
  initial: MailConfig | null;
  cdnBase: string;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = (cdnBase ?? "").replace(/\/+$/, "");

  const [cfg, setCfg] = useState<MailConfig>(initial ?? BOS);
  const [yama, setYama] = useState<Record<string, unknown>>({});
  const [smtpPass, setSmtpPass] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [kaydediyor, setKaydediyor] = useState(false);
  const [heroYukleniyor, setHeroYukleniyor] = useState(false);

  const [test, setTest] = useState<{ tur: "smtp" | "imap"; ok: boolean; mesaj: string } | null>(null);
  const [testEdiliyor, setTestEdiliyor] = useState<"smtp" | "imap" | null>(null);

  const kirli = Object.keys(yama).length > 0 || smtpPass !== "" || imapPass !== "";

  function set<K extends keyof MailConfig>(k: K, v: MailConfig[K]) {
    setCfg((p) => ({ ...p, [k]: v }));
    setYama((p) => ({ ...p, [k]: v }));
  }

  /**
   * Bağlantıyı dene.
   *
   * Kaydedilmemiş değişiklikler de gönderiliyor: kullanıcı bir
   * ayarı düzeltip önce test etmek istiyor. Kaydetmeye zorlarsak
   * yanlış ayar canlıya girer ve o sırada gerçek mailler
   * başarısız olur.
   */
  async function baglantiTest(tur: "smtp" | "imap") {
    setTestEdiliyor(tur);
    setTest(null);
    const govde: Record<string, unknown> = { tur, ...yama };
    if (tur === "smtp" && smtpPass) govde.smtp_pass = smtpPass;
    if (tur === "imap" && imapPass) govde.imap_pass = imapPass;

    try {
      const res = await fetch("/api/mail/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      const j = (await res.json().catch(() => ({}))) as
        { ok?: boolean; mesaj?: string; error?: string };
      setTest({ tur, ok: Boolean(j.ok), mesaj: j.mesaj ?? j.error ?? "Bilinmeyen sonuç" });
    } catch {
      setTest({ tur, ok: false, mesaj: "İstek gönderilemedi" });
    } finally {
      setTestEdiliyor(null);
    }
  }

  const [sifirliyor, setSifirliyor] = useState(false);

  /** Son UID'i sıfırla — gelen kutusu boş kaldıysa */
  async function sifirla() {
    setSifirliyor(true);
    const { data, error } = await sb.rpc("mail_sync_sifirla");
    setSifirliyor(false);
    if (error) { t.error(error.message); return; }
    const o = data as { eski_uid: number } | null;
    t.success(
      `Sıfırlandı (eski UID: ${o?.eski_uid ?? 0}). Mail sayfasına git, kutu baştan taranacak.`,
    );
  }

  async function heroYukle(f: File) {
    setHeroYukleniyor(true);
    try {
      const { key } = await r2Yukle(f, "library", `mail-hero-${f.name}`);
      // Kitaplığa da kaydet: Medya sayfasından yönetilebilsin
      await sb.rpc("library_add", {
        p_key: key, p_name: f.name, p_mime: f.type || "image/jpeg",
        p_bytes: f.size, p_width: null, p_height: null,
        p_title: null, p_alt: "Mail şablonu görseli",
      });
      set("hero_image_key", key);
    } catch (e) {
      t.error(e instanceof Error ? e.message : "Görsel yüklenemedi");
    } finally {
      setHeroYukleniyor(false);
    }
  }

  async function kaydet() {
    setKaydediyor(true);
    const govde: Record<string, unknown> = { ...yama };
    if (smtpPass) govde.smtp_pass = smtpPass;
    if (imapPass) govde.imap_pass = imapPass;

    const { data, error } = await sb.rpc("admin_mail_update", { p: govde });
    setKaydediyor(false);
    if (error) { t.error(error.message); return; }

    if (data) setCfg(data as unknown as MailConfig);
    setYama({}); setSmtpPass(""); setImapPass("");
    t.success("Mail ayarları kaydedildi");
  }

  const heroAdres = cfg.hero_image_key ? `${cdn}/${cfg.hero_image_key}` : null;

  return (
    <div className="flex flex-col gap-5">
      {!cfg.smtp_hazir && (
        <Alert tone="orange" title="SMTP eksik">
          Sunucu, kullanıcı ve parola girilmeden mail gönderilemez.
        </Alert>
      )}
      {cfg.imap_last_error && (
        <Alert tone="danger" title="Gelen kutusu hatası">{cfg.imap_last_error}</Alert>
      )}

      {/* ══ Servis ══ */}
      <Card className="p-5">
        <CardHead title="Mail servisi" desc="Kapalıyken hiçbir mail gönderilmez." />
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2.5 text-[13.5px]">
            <Switch checked={cfg.is_enabled}
              onChange={(v) => set("is_enabled", v)} label="Mail servisi" />
            <span>{cfg.is_enabled ? "Açık" : "Kapalı"}</span>
          </label>
          <div className="max-w-[160px]">
            <Field label="Günlük tavan" hint="0 = sınırsız">
              <Input type="number" value={cfg.daily_limit}
                onChange={(e) => set("daily_limit", Number(e.target.value))} />
            </Field>
          </div>
        </div>

        <Divider className="my-4" />
        <div className="kb-eyebrow mb-3">Otomatik mailler</div>
        <div className="flex flex-wrap gap-5">
          {([
            ["send_verification", "Doğrulama"],
            ["send_welcome", "Hoş geldin"],
            ["send_newsletter", "Bülten"],
          ] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2.5 text-[13.5px]">
              <Switch checked={cfg[k]} onChange={(v) => set(k, v)} label={l} />
              <span>{l}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* ══ SMTP ══ */}
      <Card className="p-5">
        <CardHead title="SMTP — giden mail"
          desc={`Gönderen adresi SMTP kullanıcısıyla aynı olur: ${cfg.smtp_user ?? "—"}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sunucu">
            <Input value={cfg.smtp_host ?? ""}
              onChange={(e) => set("smtp_host", e.target.value)}
              placeholder="smtp.hostinger.com" />
          </Field>
          <Field label="Port" hint="465 (SSL) ya da 587 (STARTTLS)">
            <Input type="number" value={cfg.smtp_port}
              onChange={(e) => set("smtp_port", Number(e.target.value))} />
          </Field>
          <Field label="Kullanıcı">
            <Input value={cfg.smtp_user ?? ""}
              onChange={(e) => set("smtp_user", e.target.value)}
              placeholder="iletisim@siteniz.com" />
          </Field>
          <Field label="Parola"
            hint={cfg.has_smtp_pass ? "kayıtlı — değiştirmek için yaz" : "gerekli"}>
            <Input type="password" value={smtpPass} autoComplete="new-password"
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={cfg.has_smtp_pass ? "••••••••" : ""} />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2.5 text-[13.5px]">
            <Switch checked={cfg.smtp_secure}
              onChange={(v) => set("smtp_secure", v)} label="SSL" />
            <span>SSL/TLS (465 için açık, 587 için kapalı)</span>
          </label>
        </div>

        <Divider className="my-4" />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm"
            onClick={() => baglantiTest("smtp")} loading={testEdiliyor === "smtp"}>
            <Icon name="refresh" size={15} /> Bağlantıyı test et
          </Button>
          {test?.tur === "smtp" && (
            <span className={`text-[13px] font-medium ${test.ok ? "text-green" : "text-danger"}`}>
              {test.ok ? "✓ " : "✕ "}{test.mesaj}
            </span>
          )}
        </div>
      </Card>

      {/* ══ IMAP ══ */}
      <Card className="p-5">
        <CardHead title="IMAP — gelen mail"
          desc="Açıkken gelen kutusu 5 saniyede bir güncellenir." />
        <div className="mb-4 flex items-center gap-2.5">
          <Switch checked={cfg.imap_enabled}
            onChange={(v) => set("imap_enabled", v)} label="IMAP" />
          <span className="text-[13.5px]">{cfg.imap_enabled ? "Açık" : "Kapalı"}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sunucu">
            <Input value={cfg.imap_host ?? ""} disabled={!cfg.imap_enabled}
              onChange={(e) => set("imap_host", e.target.value)}
              placeholder="imap.hostinger.com" />
          </Field>
          <Field label="Port" hint="genelde 993">
            <Input type="number" value={cfg.imap_port} disabled={!cfg.imap_enabled}
              onChange={(e) => set("imap_port", Number(e.target.value))} />
          </Field>
          <Field label="Kullanıcı">
            <Input value={cfg.imap_user ?? ""} disabled={!cfg.imap_enabled}
              onChange={(e) => set("imap_user", e.target.value)} />
          </Field>
          <Field label="Parola"
            hint={cfg.has_imap_pass ? "kayıtlı — değiştirmek için yaz" : "gerekli"}>
            <Input type="password" value={imapPass} autoComplete="new-password"
              disabled={!cfg.imap_enabled}
              onChange={(e) => setImapPass(e.target.value)}
              placeholder={cfg.has_imap_pass ? "••••••••" : ""} />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <Switch checked={cfg.imap_secure} disabled={!cfg.imap_enabled}
            onChange={(v) => set("imap_secure", v)} label="IMAP SSL" />
          <span className="text-[13.5px]">SSL/TLS (993 için açık)</span>
        </div>

        <Divider className="my-4" />
        {/*
          Arka plan kontrolü panelin sunucu rotasına istek atıyor;
          bunun için panelin dış adresini bilmesi gerekiyor.
          Boşsa kontrol yalnızca panel açıkken çalışır.
        */}
        <Field label="Panel adresi"
          hint="arka plan kontrolü için — panel kapalıyken de mail düşsün">
          <Input value={cfg.sync_url ?? ""}
            onChange={(e) => set("sync_url", e.target.value)}
            placeholder="https://panel.kuzeybatihaber.com.tr" />
        </Field>

        <Divider className="my-4" />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm"
            onClick={() => baglantiTest("imap")} loading={testEdiliyor === "imap"}
            disabled={!cfg.imap_enabled}>
            <Icon name="refresh" size={15} /> Bağlantıyı test et
          </Button>
          {/*
            Son UID takılırsa gelen kutusu boş kalır: senkron
            "bu eşiği geçen mail yok" der ve hiçbir şey indirmez.
            Sıfırlama eşiği kaldırıp kutuyu baştan taratıyor.
            Var olan mailler tekilleştirme sayesinde iki kez
            yazılmıyor.
          */}
          <Button variant="ghost" size="sm" onClick={sifirla}
            loading={sifirliyor} disabled={!cfg.imap_enabled}>
            Baştan tara
          </Button>
          {test?.tur === "imap" && (
            <span className={`text-[13px] font-medium ${test.ok ? "text-green" : "text-danger"}`}>
              {test.ok ? "✓ " : "✕ "}{test.mesaj}
            </span>
          )}
        </div>
      </Card>

      {/* ══ Şablon görseli ══ */}
      <Card className="p-5">
        <CardHead title="Mail şablonu görseli"
          desc="Gönderdiğin maillerin en üstünde çıkar. Kaldırırsan görsel çizilmez." />
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-chip">
            {heroAdres ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={heroAdres} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="media" size={22} />
            )}
          </span>
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer">
              <span className="kb-lift inline-flex items-center gap-2 rounded-full border border-line2 bg-chip px-4 py-2 text-[13px] font-semibold">
                <Icon name={heroYukleniyor ? "loading" : "media"} size={15} />
                {heroYukleniyor ? "Yükleniyor…" : "Görsel yükle"}
              </span>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void heroYukle(f); e.target.value = ""; }} />
            </label>
            {cfg.hero_image_key && (
              <Button variant="ghost" size="sm"
                onClick={() => set("hero_image_key", null)}>Kaldır</Button>
            )}
            <span className="text-[12px] text-muted2">
              Logo ayrıca seçilmiyor — Görünüm ayarlarındaki logo kullanılır.
            </span>
          </div>
        </div>
      </Card>

      <SaveBar
        dirty={kirli}
        saving={kaydediyor}
        onSave={kaydet}
        onReset={() => {
          setCfg(initial ?? BOS); setYama({});
          setSmtpPass(""); setImapPass("");
        }}
        note="Mail ayarları değişti."
      />
    </div>
  );
}
