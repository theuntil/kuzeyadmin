"use client";
import { useState, useRef, type KeyboardEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle, r2Vazgec } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { Button, Card, Alert } from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   YENİ MAİL

   ┌─ AYRI SAYFA ⚠️ ───────────────────────────────────────────┐
   │ Önce mail ekranının içinde açılıyordu ve liste altında     │
   │ kayboluyordu. Uzun bir mail yazarken kaza ile sekme        │
   │ değiştirmek yazılanı siliyordu.                             │
   │                                                              │
   │ Ayrı adres (`/mail/yeni`): geri düğmesi çalışıyor, adres    │
   │ paylaşılabiliyor, yanlışlıkla kapanmıyor.                   │
   └──────────────────────────────────────────────────────────────┘

   ┌─ EKLER R2'YE ⚠️ ──────────────────────────────────────────┐
   │ Dosya seçilir seçilmez R2'ye yükleniyor; kuyruğa yalnızca │
   │ ANAHTAR yazılıyor. 20 MB'lık bir dosyayı base64 olarak     │
   │ kuyruk satırına gömmek satırı 27 MB yapardı.               │
   │                                                              │
   │ Mail gidince ekler silme kuyruğuna düşüyor — alıcının       │
   │ kutusunda zaten var, R2'de tutmanın anlamı yok.             │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Ek {
  key: string;
  name: string;
  size: number;
  type: string;
}

const TEK_DOSYA_MB = 20;
const TOPLAM_MB = 24;

const VARSAYILAN_GOVDE = "Merhaba,\n\n\n\nSaygılarımızla,\n";

function boyutYaz(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function MailCompose({ gonderen }: { gonderen: string | null }) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [alicilar, setAlicilar] = useState<string[]>([]);
  const [aliciMetin, setAliciMetin] = useState("");
  const [konu, setKonu] = useState("");
  const [baslik, setBaslik] = useState("");
  const [html, setHtml] = useState(false);
  const [govde, setGovde] = useState(VARSAYILAN_GOVDE);

  const [ekler, setEkler] = useState<Ek[]>([]);
  const [logo, setLogo] = useState<{ key: string; url: string } | null>(null);
  /* Maile gömülecek TAM adres — mail istemcileri göreli yol okumaz */
  const logoAdres = logo?.url ?? null;
  const [yukleniyor, setYukleniyor] = useState<string | null>(null);
  const [surukle, setSurukle] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const ekRef = useRef<HTMLInputElement | null>(null);
  const logoRef = useRef<HTMLInputElement | null>(null);

  const toplam = ekler.reduce((n, e) => n + e.size, 0);

  /* ---- Alıcı çipleri ---- */
  function aliciEkle(ham: string) {
    const adres = ham.trim().replace(/[,;]$/, "").toLowerCase();
    if (!adres) return;
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adres)) {
      setHata(`Geçersiz adres: ${adres}`);
      return;
    }
    if (alicilar.includes(adres)) { setAliciMetin(""); return; }
    setAlicilar((p) => [...p, adres]);
    setAliciMetin("");
    setHata(null);
  }

  function aliciTus(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === " ") {
      e.preventDefault();
      aliciEkle(aliciMetin);
    } else if (e.key === "Backspace" && !aliciMetin && alicilar.length) {
      // Boş alanda Backspace son çipi siler — posta istemcilerinin alışkanlığı
      setAlicilar((p) => p.slice(0, -1));
    }
  }

  /* ---- Ek yükleme ---- */
  async function ekYukle(files: FileList | File[]) {
    setHata(null);
    for (const f of Array.from(files)) {
      if (f.size > TEK_DOSYA_MB * 1024 * 1024) {
        setHata(`${f.name}: tek dosya en fazla ${TEK_DOSYA_MB} MB`);
        continue;
      }
      if (toplam + f.size > TOPLAM_MB * 1024 * 1024) {
        setHata(`Toplam ek boyutu ${TOPLAM_MB} MB'ı geçemez`);
        break;
      }
      setYukleniyor(f.name);
      try {
        const { key } = await r2Yukle(f, "library", f.name);
        /*
         * Ek MEDYA KİTAPLIĞINA da kaydediliyor. Böylece Medya
         * sayfasında görünüyor ve istenirse oradan silinebiliyor.
         * Kayıt başarısız olsa da mail gönderilebilir — dosya
         * R2'de duruyor, yalnızca listede görünmüyor.
         */
        await sb.rpc("library_add", {
          p_key: key, p_name: f.name, p_mime: f.type || "application/octet-stream",
          p_bytes: f.size, p_width: null, p_height: null,
          p_title: null, p_alt: "Mail eki",
        });
        setEkler((p) => [...p, { key, name: f.name, size: f.size, type: f.type }]);
      } catch (e) {
        setHata(`${f.name}: ${e instanceof Error ? e.message : "yüklenemedi"}`);
      } finally {
        setYukleniyor(null);
      }
    }
  }

  async function ekSil(k: string) {
    setEkler((p) => p.filter((e) => e.key !== k));
    await r2Vazgec(k);   // yüklenmiş ama gönderilmemiş dosya kalmasın
  }

  async function logoYukle(f: File) {
    setYukleniyor("logo");
    try {
      const { key, url } = await r2Yukle(f, "library", `logo-${f.name}`);
      await sb.rpc("library_add", {
        p_key: key, p_name: f.name, p_mime: f.type || "image/png",
        p_bytes: f.size, p_width: null, p_height: null,
        p_title: null, p_alt: "Karşı kurum logosu",
      });
      setLogo({ key, url });
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Logo yüklenemedi");
    } finally {
      setYukleniyor(null);
    }
  }

  /* ---- Gönder ---- */
  async function gonder() {
    // Kutuda yazılıp Enter'a basılmamış adres varsa onu da al
    const son = aliciMetin.trim();
    const hepsi = son ? [...alicilar, son.toLowerCase()] : alicilar;

    if (hepsi.length === 0) { setHata("En az bir alıcı gerekli"); return; }
    if (!konu.trim())       { setHata("Konu boş olamaz"); return; }
    if (!govde.trim())      { setHata("Mesaj boş olamaz"); return; }

    setGonderiyor(true);
    setHata(null);

    /*
     * ⚠ KUYRUK DEĞİL, DOĞRUDAN GÖNDERİM.
     *
     * Eskiden `admin_mail_send` RPC'si maili kuyruğa yazıyordu
     * ve ayrı bir servis gönderiyordu. Servis yapılandırması
     * eksikse mail sessizce kuyrukta kalıyor, panel yine
     * "gönderildi" diyordu.
     *
     * Artık sunucu rotası SMTP'ye bağlanıp gönderiyor; hata
     * varsa gerçek sebebi burada görüyoruz.
     */
    const res = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: hepsi,
        subject: konu,
        heading: baslik || null,
        body: govde,
        is_html: html,
        partner_logo: logo ? logoAdres : null,
        attachments: ekler,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; mesaj?: string };
    setGonderiyor(false);

    if (!res.ok) {
      setHata(j.error ?? "Mail gönderilemedi");
      return;
    }

    t.success(j.mesaj ?? "Mail gönderildi");

    /*
     * Gönderilenler kutusuna dön. `replace` kullanılıyor:
     * geri düğmesi boş kalmış yazma formuna dönmesin.
     */
    window.location.replace("/mail?kutu=outbox");
  }

  return (
    <div className="flex flex-col gap-5">
      {hata && <Alert tone="danger">{hata}</Alert>}

      <Card className="overflow-hidden p-0">
        {/* ── Kime ── */}
        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:gap-4">
          <span className="w-16 shrink-0 pt-3 text-[13px] font-semibold text-muted">
            Kime
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-line2 bg-field px-3 py-2">
              {alicilar.map((a) => (
                <span key={a}
                  className="inline-flex items-center gap-1.5 rounded-full bg-chip px-2.5 py-1 text-[12.5px]">
                  {a}
                  <button type="button" onClick={() => setAlicilar((p) => p.filter((x) => x !== a))}
                    aria-label={`${a} kaldır`} className="text-muted2 hover:text-danger">
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
              <input
                value={aliciMetin}
                onChange={(e) => setAliciMetin(e.target.value)}
                onKeyDown={aliciTus}
                onBlur={() => aliciEkle(aliciMetin)}
                type="email"
                placeholder={alicilar.length ? "" : "ornek@kurum.gov.tr"}
                className="min-w-[180px] flex-1 bg-transparent py-1 text-[14.5px] outline-none placeholder:text-muted2"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-muted2">
              Adresi yazıp <strong>Enter</strong>&apos;a basın. Birden fazla alıcı
              ekleyebilirsiniz.
            </p>
          </div>
        </div>

        {/* ── Konu ── */}
        <div className="flex items-center gap-4 border-t border-line2 px-5 py-3">
          <span className="w-16 shrink-0 text-[13px] font-semibold text-muted">Konu</span>
          <input
            value={konu} onChange={(e) => setKonu(e.target.value)}
            placeholder="Mailin konusu"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted2"
          />
        </div>

        {/* ── Başlık ── */}
        <div className="flex items-center gap-4 border-t border-line2 px-5 py-3">
          <span className="w-16 shrink-0 text-[13px] font-semibold text-muted">Başlık</span>
          <input
            value={baslik} onChange={(e) => setBaslik(e.target.value)}
            placeholder="İsteğe bağlı — örn. Sayın yetkili,"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-muted2"
          />
        </div>

        {/* ── Biçim ── */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line2 px-5 py-3">
          <span className="w-16 shrink-0 text-[13px] font-semibold text-muted">Biçim</span>
          <div className="flex gap-1.5">
            {[
              { v: false, l: "Metin" },
              { v: true, l: "HTML" },
            ].map((o) => (
              <button
                key={o.l} type="button" onClick={() => setHtml(o.v)}
                className={`kb-lift rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  html === o.v ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          <span className="ms-auto text-[12px] text-muted2">
            {html ? "HTML etiketleri işlenir" : "Alt satıra geçmeler korunur"}
          </span>
        </div>

        {/* ── Gövde ── */}
        <textarea
          value={govde}
          onChange={(e) => setGovde(e.target.value)}
          className="min-h-[320px] w-full resize-y border-t border-line2 bg-transparent px-5 py-4 text-[14.5px] leading-[1.7] outline-none"
          placeholder={html ? "<p>Merhaba,</p>" : "Merhaba,"}
          spellCheck
        />
      </Card>

      {/* ── Ekler ── */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-[14px] font-semibold">
            <Icon name="file" size={16} /> Dosya ekleri
          </span>
          <span className="text-[12.5px] text-muted2">· isteğe bağlı</span>
          <Button variant="outline" size="sm" className="ms-auto"
            onClick={() => ekRef.current?.click()} loading={Boolean(yukleniyor && yukleniyor !== "logo")}>
            <Icon name="media" size={15} /> Dosya ekle
          </Button>
        </div>

        {ekler.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {ekler.map((e) => (
              <li key={e.key}
                className="flex items-center gap-3 rounded-[12px] bg-chip px-3.5 py-2.5">
                <Icon name="file" size={16} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{e.name}</span>
                  <span className="kb-num text-[12px] text-muted2">
                    {boyutYaz(e.size)} · {e.type || "dosya"}
                  </span>
                </span>
                <button type="button" onClick={() => ekSil(e.key)}
                  aria-label={`${e.name} kaldır`}
                  className="text-muted2 transition-colors hover:text-danger">
                  <Icon name="trash" size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setSurukle(true); }}
          onDragLeave={() => setSurukle(false)}
          onDrop={(e) => {
            e.preventDefault(); setSurukle(false);
            if (e.dataTransfer.files.length) void ekYukle(e.dataTransfer.files);
          }}
          className={`rounded-[14px] border border-dashed px-4 py-7 text-center transition-colors ${
            surukle ? "border-accent-line bg-chip" : "border-line2"
          }`}
        >
          <p className="text-[13px] text-muted">
            Dosyaları buraya sürükleyin ya da &ldquo;Dosya ekle&rdquo; ile seçin
          </p>
          <p className="kb-num mt-1 text-[12px] text-muted2">
            Tek dosya en fazla {TEK_DOSYA_MB} MB · toplam {TOPLAM_MB} MB
            {toplam > 0 && ` · şu an ${boyutYaz(toplam)}`}
          </p>
        </div>

        <input ref={ekRef} type="file" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) void ekYukle(e.target.files); e.target.value = ""; }} />
      </Card>

      {/* ── Karşı logo ── */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="media" size={16} />
          <span className="text-[14px] font-semibold">Karşı logo</span>
          <span className="text-[12.5px] text-muted2">· isteğe bağlı</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-muted">Karşı kurumun logosu</span>
          <span className="ms-auto text-[12px] text-muted2">PNG · şeffaf zemin · bizim logomuz otomatik</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-chip">
            {logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logo.url} alt="" className="h-full w-full object-contain" />
            ) : (
              <Icon name="media" size={20} />
            )}
          </span>
          <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}
            loading={yukleniyor === "logo"}>
            <Icon name="media" size={15} /> Görsel yükle
          </Button>
          {logo && (
            <Button variant="ghost" size="sm" onClick={() => { void r2Vazgec(logo.key); setLogo(null); }}>
              Kaldır
            </Button>
          )}
        </div>
        <input ref={logoRef} type="file" accept="image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void logoYukle(f); e.target.value = ""; }} />
      </Card>

      {/* ── Gönder ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={gonder} loading={gonderiyor} size="lg">
          <Icon name="send" size={17} /> Gönder
        </Button>
        <span className="text-[13px] text-muted">
          Mail anında gider<strong>Giden postalar</strong>&apos;a düşer.
        </span>
        {gonderen && (
          <span className="ms-auto text-[12.5px] text-muted2">
            {gonderen} adresinden
          </span>
        )}
      </div>
    </div>
  );
}
