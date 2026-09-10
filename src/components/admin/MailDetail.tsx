"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { Button, Card, Field, Textarea, Alert, Input } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import Icon from "@/components/ui/Icon";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   MAİL DETAYI

   ┌─ GÖVDE SANDBOX İFRAME'DE ⚠️ ───────────────────────────────┐
   │ Gelen mailin HTML'i olduğu gibi saklanıyor — temizlemek     │
   │ gömülü resmi ve biçimi bozar. `sandbox` iframe'de           │
   │ gösteriliyor: script çalışmaz, form gönderilmez, üst        │
   │ pencereye erişilemez.                                        │
   │                                                              │
   │ `allow-same-origin` BİLEREK YOK. Verilseydi mail bizim      │
   │ kaynağımızda çalışır ve oturum çerezine erişebilirdi.       │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface Detay {
  id: string;
  box: string;
  status: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  to_list: string[] | null;
  body_html: string | null;
  body_text: string | null;
  is_starred: boolean;
  attachments: { filename: string | null; size: number; contentType: string; key?: string }[];
  error: string | null;
  received_at: string | null;
  sent_at: string | null;
}

function boyutYaz(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function MailDetail({
  mail, cdnBase,
}: {
  mail: Detay;
  cdnBase: string;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [m, setM] = useState(mail);
  const [mod, setMod] = useState<"oku" | "yanit" | "ilet">("oku");
  const [metin, setMetin] = useState("");
  const [iletAdres, setIletAdres] = useState("");
  const [gonderiyor, setGonderiyor] = useState(false);
  const [silOnay, setSilOnay] = useState(false);

  const gelen = m.box === "inbox";
  const tarih = m.received_at ?? m.sent_at;

  async function yildiz() {
    const yeni = !m.is_starred;
    setM((p) => ({ ...p, is_starred: yeni }));
    const { error } = await sb.rpc("admin_mail_flag", {
      p_ids: [m.id], p_alan: "is_starred", p_deger: yeni,
    });
    if (error) { setM((p) => ({ ...p, is_starred: !yeni })); t.error(error.message); }
  }

  /**
   * Yanıtla — KUYRUK YOK.
   *
   * RPC yalnızca alıcı/konu/zincir bilgisini hazırlıyor;
   * gönderme işini `/api/mail` yapıyor ve SMTP'ye anında
   * bağlanıyor. Hata varsa kullanıcı o anda görüyor.
   */
  async function yanitla() {
    if (!metin.trim()) { t.error("Mesaj boş olamaz"); return; }
    setGonderiyor(true);

    const { data, error } = await sb.rpc("admin_mail_reply", {
      p: { reply_to: m.id, body: metin },
    });
    if (error) { setGonderiyor(false); t.error(error.message); return; }

    const h = data as {
      to: string; subject: string; body: string; in_reply_to: string | null;
    } | null;
    if (!h) { setGonderiyor(false); t.error("Yanıt hazırlanamadı"); return; }

    const res = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [h.to], subject: h.subject, body: h.body,
        is_html: false, in_reply_to: h.in_reply_to,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; mesaj?: string };
    setGonderiyor(false);

    if (!res.ok) { t.error(j.error ?? "Yanıt gönderilemedi"); return; }
    t.success(j.mesaj ?? "Yanıt gönderildi");
    window.location.replace("/mail?kutu=outbox");
  }

  async function ilet() {
    if (!iletAdres.trim()) { t.error("Alıcı gerekli"); return; }
    setGonderiyor(true);

    const { data, error } = await sb.rpc("admin_mail_forward", {
      p: { forward_of: m.id, to: iletAdres, note: metin || null },
    });
    if (error) { setGonderiyor(false); t.error(error.message); return; }

    const h = data as { to: string; subject: string; body: string } | null;
    if (!h) { setGonderiyor(false); t.error("İletim hazırlanamadı"); return; }

    const res = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: [h.to], subject: h.subject, body: h.body, is_html: false,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; mesaj?: string };
    setGonderiyor(false);

    if (!res.ok) { t.error(j.error ?? "Mail iletilemedi"); return; }
    t.success(j.mesaj ?? "Mail iletildi");
    window.location.replace("/mail?kutu=outbox");
  }

  async function sil() {
    const { error } = await sb.rpc("admin_mail_delete", { p_ids: [m.id] });
    setSilOnay(false);
    if (error) { t.error(error.message); return; }
    t.success("Mail silindi");
    window.location.replace(`/mail?kutu=${gelen ? "inbox" : "outbox"}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Üst çubuk ── */}
      <header className="flex flex-wrap items-center gap-3">
        <Link href={`/mail?kutu=${gelen ? "inbox" : "outbox"}`}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted transition-colors hover:text-ink">
          ‹ {gelen ? "Gelen postalar" : "Giden postalar"}
        </Link>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          {gelen && (
            <>
              <Button size="sm" onClick={() => { setMod(mod === "yanit" ? "oku" : "yanit"); setMetin(""); }}>
                <Icon name="send" size={15} /> Yanıtla
              </Button>
              <Button variant="outline" size="sm"
                onClick={() => { setMod(mod === "ilet" ? "oku" : "ilet"); setMetin(""); }}>
                <Icon name="copy" size={15} /> İlet
              </Button>
            </>
          )}
          <button
            type="button" onClick={yildiz}
            aria-label={m.is_starred ? "Yıldızı kaldır" : "Yıldızla"}
            className={`kb-lift flex h-9 w-9 items-center justify-center rounded-full bg-chip transition-colors ${
              m.is_starred ? "text-ink" : "text-muted2 hover:text-ink"
            }`}
          >
            <Icon name="star" size={16} dolu={m.is_starred} />
          </button>
          <Button variant="outline" size="sm" onClick={() => setSilOnay(true)}>
            <Icon name="trash" size={15} /> Sil
          </Button>
        </div>
      </header>

      {/* ── Başlık ── */}
      <div>
        <h1 className="kb-h1">{m.subject || "(konu yok)"}</h1>
        <div className="mt-3 flex flex-col gap-1 text-[13.5px]">
          {gelen ? (
            <span className="text-muted">
              Kimden:{" "}
              <strong className="text-ink">{m.from_name ?? m.from_email}</strong>
              {m.from_name && m.from_email && (
                <span className="text-muted"> · {m.from_email}</span>
              )}
            </span>
          ) : null}
          <span className="text-muted">
            Kime: <span className="text-ink2">
              {(m.to_list?.length ? m.to_list.join(", ") : m.to_email) ?? "—"}
            </span>
          </span>
          {tarih && (
            <span className="kb-num text-[12.5px] text-muted2">
              {new Date(tarih).toLocaleString("tr-TR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {m.error && <Alert tone="danger" title="Gönderim hatası">{m.error}</Alert>}

      {/* ── Ekler ── */}
      {m.attachments?.length > 0 && (
        <Card className="p-5">
          <div className="kb-eyebrow mb-3">Ekler · {m.attachments.length}</div>
          <ul className="flex flex-col gap-2">
            {m.attachments.map((a, i) => {
              const adres = a.key ? `${cdn}/${a.key}` : null;
              return (
                <li key={i}
                  className="flex items-center gap-3 rounded-[14px] bg-chip px-3.5 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-surface text-muted">
                    <Icon name="file" size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {a.filename ?? "adsız"}
                    </span>
                    <span className="kb-num text-[12px] text-muted2">
                      {boyutYaz(a.size)} · {a.contentType}
                    </span>
                  </span>
                  {adres ? (
                    <a href={adres} download aria-label={`${a.filename} indir`}
                      className="kb-lift flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-ink">
                      <Icon name="file" size={16} />
                    </a>
                  ) : (
                    /*
                     * Gelen maillerin ekleri IMAP'ta duruyor; henüz
                     * R2'ye indirilmiyor. Adı ve boyutu görünüyor
                     * ama indirme yok — yanıltıcı bir düğme koymak
                     * yerine sebebini söylüyoruz.
                     */
                    <span className="text-[11.5px] text-muted2" title="Gelen maillerin ekleri henüz indirilemiyor">
                      sunucuda
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ── Gövde ── */}
      {m.body_html ? (
        <iframe
          title="Mail içeriği"
          sandbox=""
          srcDoc={m.body_html}
          className="h-[520px] w-full rounded-[18px] bg-white"
        />
      ) : (
        <Card className="p-5">
          <pre className="kb-scrollbar max-h-[520px] overflow-auto whitespace-pre-wrap text-[14px] leading-[1.75]">
            {m.body_text || "(içerik yok)"}
          </pre>
        </Card>
      )}

      {/*
        ── Yanıt / İlet ──

        ⚠ POPUP, sayfanın altı DEĞİL.
        Önce sayfanın en altında açılıyordu; uzun bir mailde
        kullanıcı yazdığı yeri göremiyor, aşağı kaydırmak
        zorunda kalıyordu.
      */}
      <Modal
        open={mod !== "oku"}
        onClose={() => setMod("oku")}
        title={mod === "yanit" ? "Yanıtla" : "İlet"}
        wide
      >
        <div className="flex flex-col gap-4">
          {mod === "yanit" ? (
            <div className="rounded-[14px] bg-chip px-4 py-2.5 text-[13px]">
              <span className="text-muted">Kime: </span>
              <strong>{m.from_email}</strong>
            </div>
          ) : (
            <Field label="Kime" hint="tek adres">
              <Input type="email" value={iletAdres} autoFocus
                onChange={(e) => setIletAdres(e.target.value)}
                placeholder="ornek@kurum.gov.tr" />
            </Field>
          )}

          <Field
            label={mod === "yanit" ? "Mesaj" : "Not"}
            hint={mod === "ilet" ? "isteğe bağlı" : undefined}
          >
            <Textarea value={metin} onChange={(e) => setMetin(e.target.value)}
              className="min-h-[220px]"
              autoFocus={mod === "yanit"}
              placeholder={mod === "yanit"
                ? "Merhaba, mesajınız için teşekkürler…"
                : "İletirken eklemek istediğin not…"} />
          </Field>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={mod === "yanit" ? yanitla : ilet} loading={gonderiyor}>
              <Icon name="send" size={16} /> {mod === "yanit" ? "Gönder" : "İlet"}
            </Button>
            <Button variant="ghost" onClick={() => setMod("oku")}>Vazgeç</Button>
            <span className="text-[12.5px] text-muted">
              Mail anında gider.
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={silOnay}
        onClose={() => setSilOnay(false)}
        title="Mail silinsin mi?"
        description="Geri alınamaz."
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
