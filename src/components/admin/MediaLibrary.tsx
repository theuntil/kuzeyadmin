"use client";
import { useState, useRef, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { r2Yukle, r2Vazgec } from "@/lib/upload";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState, Button } from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   MEDYA KİTAPLIĞI

   Bırakma alanı üstte, dosyalar altta ızgara. Her kart:
   önizleme → ad → boyut → URL kopyala + sil.

   ┌─ KÜÇÜK RESİM ÜRETİLMİYOR ⚠️ ───────────────────────────────┐
   │ Kitaplık dosyaları birkaç yüz KB ve sayıları az. Bot       │
   │ medyası gibi varyant üretmek burada gereksiz karmaşıklık   │
   │ olurdu. `loading="lazy"` ile ekrana girene kadar           │
   │ indirilmiyor.                                                │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface LibItem {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

const KABUL =
  "image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,application/pdf,video/mp4";
const MAX_MB = 25;

function boyutYaz(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function MediaLibrary({
  items, cdnBase,
}: {
  items: LibItem[];
  cdnBase: string;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");
  const url = (key: string) => `${cdn}/${key}`;

  const [list, setList] = useState<LibItem[]>(items);
  const [busy, setBusy] = useState(false);
  const [yuzde, setYuzde] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [surukle, setSurukle] = useState(false);
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<LibItem | null>(null);
  /** Büyük görüntüleme penceresi */
  const [acik, setAcik] = useState<LibItem | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Görsel boyutunu tarayıcıda ölç — sunucuda işleme gerekmesin */
  function olcu(file: File): Promise<{ w: number; h: number } | null> {
    if (!file.type.startsWith("image/")) return Promise.resolve(null);
    return new Promise((c) => {
      const img = new window.Image();
      const u = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(u); c({ w: img.width, h: img.height }); };
      img.onerror = () => { URL.revokeObjectURL(u); c(null); };
      img.src = u;
    });
  }

  const yukle = useCallback(async (files: FileList | File[]) => {
    setBusy(true); setErr(null);

    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setErr(`${file.name}: dosya ${MAX_MB} MB'den büyük`);
        continue;
      }

      let key = "";
      try {
        ({ key } = await r2Yukle(file, "library", file.name, setYuzde));
      } catch (e) {
        setErr(`${file.name}: ${e instanceof Error ? e.message : "yüklenemedi"}`);
        setYuzde(null);
        continue;
      }
      setYuzde(null);

      const d = await olcu(file);
      const { data, error } = await sb.rpc("library_add", {
        p_key: key, p_name: file.name, p_mime: file.type,
        p_bytes: file.size,
        p_width: d?.w ?? null, p_height: d?.h ?? null,
        p_title: null, p_alt: null,
      });

      if (error) {
        // Kayıt olmadıysa yüklenen dosya yetim kalmasın
        await r2Vazgec(key);
        setErr(`${file.name}: ${error.message}`);
        continue;
      }
      if (data) setList((p) => [data as unknown as LibItem, ...p]);
    }

    setBusy(false);
  }, [sb]);

  async function sil() {
    if (!silinecek) return;
    const hedef = silinecek;
    const { error } = await sb.rpc("library_delete", { p_id: hedef.id });
    setSilinecek(null);
    if (error) { t.error(error.message); return; }
    setList((p) => p.filter((x) => x.id !== hedef.id));
    if (acik?.id === hedef.id) setAcik(null);
    t.success("Dosya silindi");
  }

  async function kopyala(k: string, id: string) {
    try {
      await navigator.clipboard.writeText(url(k));
      setKopyalanan(id);
      setTimeout(() => setKopyalanan(null), 1600);
    } catch {
      t.error("Kopyalanamadı — adresi elle seç");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {err && <Alert tone="danger">{err}</Alert>}

      {/* ── Bırakma alanı ── */}
      <div className="rounded-[20px] bg-surface p-5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setSurukle(true); }}
          onDragLeave={() => setSurukle(false)}
          onDrop={(e) => {
            e.preventDefault(); setSurukle(false);
            if (e.dataTransfer.files.length) void yukle(e.dataTransfer.files);
          }}
          disabled={busy}
          className={`flex w-full flex-col items-center justify-center gap-3 rounded-[16px]
            border border-dashed px-6 py-12 transition-colors duration-200
            ${surukle ? "border-accent-line bg-chip" : "border-line2 hover:bg-chip"}
            ${busy ? "opacity-60" : ""}`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-solid text-on-solid">
            {busy
              ? <span className="kb-spin inline-block h-5 w-5 rounded-full border-2 border-current border-t-transparent" />
              : <Icon name="media" size={22} />}
          </span>
          <span className="text-[14.5px] font-semibold">
            {busy
              ? (yuzde !== null ? `Yükleniyor… %${yuzde}` : "Yükleniyor…")
              : "Dosyayı sürükleyin veya tıklayın"}
          </span>
          <span className="text-[12.5px] text-muted">
            Görsel, PDF veya MP4 · en fazla {MAX_MB} MB
          </span>
        </button>

        <input
          ref={inputRef} type="file" multiple accept={KABUL} className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void yukle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Izgara ── */}
      {list.length === 0 ? (
        <EmptyState
          title="Kitaplık boş"
          description="Yüklediğin görseller burada durur; logo, kapak ve haber görsellerinde kullanılır."
        />
      ) : (
        <div className="kb-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((m) => {
            const gorsel = m.mime_type.startsWith("image/");
            const video = m.mime_type.startsWith("video/");
            return (
              <div key={m.id} className="overflow-hidden rounded-[16px] bg-surface">
                {/*
                  ⚠ `object-contain`, `cover` DEĞİL.
                  `cover` görselin kenarlarını kırpıyordu; dikey bir
                  afişin yalnızca ortası görünüyordu. `contain` ile
                  görsel TAMAMEN sığıyor, boşluk zeminle doluyor.

                  Sabit 4:3 oran: görsel yüklenirken ızgara kaymıyor.
                */}
                <button
                  type="button"
                  onClick={() => setAcik(m)}
                  aria-label={`${m.file_name} büyüt`}
                  className="relative block aspect-[4/3] w-full bg-chip transition-opacity hover:opacity-85"
                >
                  {gorsel ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={url(m.storage_key)} alt={m.file_name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted2">
                      <Icon name={video ? "media" : "file"} size={26} />
                      <span className="text-[11px] font-semibold uppercase">
                        {m.file_name.split(".").pop()}
                      </span>
                    </span>
                  )}
                </button>

                <div className="p-3">
                  <div className="truncate text-[13px] font-semibold" title={m.file_name}>
                    {m.file_name}
                  </div>
                  <div className="kb-num mt-0.5 text-[12px] text-muted">
                    {boyutYaz(m.bytes)}
                    {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                  </div>

                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => kopyala(m.storage_key, m.id)}
                      className="kb-lift flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line2 bg-chip px-2 py-1.5 text-[12px] font-semibold transition-colors hover:brightness-125"
                    >
                      <Icon name={kopyalanan === m.id ? "check" : "copy"} size={13} />
                      {kopyalanan === m.id ? "Kopyalandı" : "URL"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSilinecek(m)}
                      aria-label={`${m.file_name} sil`}
                      className="kb-lift flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] border border-line2 bg-chip text-muted transition-colors hover:text-danger"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Büyük görüntüleme ══ */}
      {acik && (
        <div
          role="dialog" aria-modal="true" aria-label={acik.file_name}
          onClick={() => setAcik(null)}
          className="kb-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          {/*
            İçeriğe tıklama pencereyi KAPATMAMALI — kullanıcı
            görseli incelerken kazara kapanıyordu.
          */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="kb-scale flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[20px] bg-surface"
          >
            <div className="flex items-center gap-3 px-5 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">
                  {acik.file_name}
                </span>
                <span className="kb-num text-[12px] text-muted2">
                  {boyutYaz(acik.bytes)}
                  {acik.width && acik.height ? ` · ${acik.width}×${acik.height}` : ""}
                  {` · ${acik.mime_type}`}
                </span>
              </span>
              <button type="button" onClick={() => setAcik(null)} aria-label="Kapat"
                className="kb-lift flex h-9 w-9 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-ink">
                <Icon name="close" size={17} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-2">
              {acik.mime_type.startsWith("image/") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={url(acik.storage_key)} alt={acik.file_name}
                  className="max-h-[70vh] w-auto max-w-full object-contain" />
              ) : acik.mime_type === "application/pdf" ? (
                /*
                  PDF tarayıcının kendi görüntüleyicisinde açılıyor.
                  Ayrı bir PDF kütüphanesi eklemek 300 KB'lık bir
                  paket demekti; tarayıcılar bunu zaten yapıyor.
                */
                <iframe title={acik.file_name} src={url(acik.storage_key)}
                  className="h-[70vh] w-full rounded-[12px] bg-white" />
              ) : acik.mime_type.startsWith("video/") ? (
                <video src={url(acik.storage_key)} controls
                  className="max-h-[70vh] w-auto max-w-full rounded-[12px]" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-muted">
                  <Icon name="file" size={40} />
                  <span className="text-[13.5px]">Bu dosya türü önizlenemiyor</span>
                  <a href={url(acik.storage_key)} download
                    className="kb-lift rounded-full bg-solid px-5 py-2.5 text-[13.5px] font-semibold text-on-solid">
                    İndir
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
              <Button variant="outline" size="sm"
                onClick={() => kopyala(acik.storage_key, acik.id)}>
                <Icon name={kopyalanan === acik.id ? "check" : "copy"} size={15} />
                {kopyalanan === acik.id ? "Kopyalandı" : "URL kopyala"}
              </Button>
              <a href={url(acik.storage_key)} target="_blank" rel="noreferrer"
                className="kb-lift inline-flex items-center gap-1.5 rounded-full border border-line2 bg-chip px-4 py-2 text-[13px] font-semibold">
                <Icon name="file" size={15} /> Yeni sekmede aç
              </a>
              <Button variant="ghost" size="sm" className="ms-auto"
                onClick={() => setSilinecek(acik)}>
                <Icon name="trash" size={15} /> Sil
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(silinecek)}
        onClose={() => setSilinecek(null)}
        title={`"${silinecek?.file_name}" silinsin mi?`}
        description="Dosya R2'den de silinir. Site ayarlarında kullanılıyorsa silme reddedilir."
        confirmLabel="Sil"
        onConfirm={sil}
      />
    </div>
  );
}
