"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   QR KOD YÖNETİMİ

   ┌─ KOD DEĞİL, YÖNLENDİRME ⚠️ ────────────────────────────────┐
   │ QR'ın içine hedef adres doğrudan gömülseydi, basılmış bir  │
   │ afişteki kodun gittiği yer bir daha değiştirilemezdi.      │
   │                                                              │
   │ Bunun yerine kod `/q/<kısa-kod>` adresini taşıyor; site    │
   │ oradan gerçek hedefe yönlendiriyor. Hedefi panelden        │
   │ değiştirmek yetiyor, afişi yeniden basmak gerekmiyor.      │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface Qr {
  id: string;
  kod: string;
  baslik: string;
  hedef: string;
  aktif: boolean;
  okunma: number;
  son_okunma: string | null;
  created_at: string;
}

export default function QrPanel({ siteUrl }: { siteUrl: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const site = siteUrl.replace(/\/+$/, "");

  const [liste, setListe] = useState<Qr[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [baslik, setBaslik] = useState("");
  const [hedef, setHedef] = useState("");
  const [ozelKod, setOzelKod] = useState("");
  const [ekliyor, setEkliyor] = useState(false);
  const [ekleAcik, setEkleAcik] = useState(false);

  const [duzenlenen, setDuzenlenen] = useState<Qr | null>(null);
  const [silinecek, setSilinecek] = useState<Qr | null>(null);
  const [siliniyor, setSiliniyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_qr_liste");
    setYukleniyor(false);
    if (error) { t.error("Liste okunamadı: " + error.message); return; }
    setListe((data ?? []) as Qr[]);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  const adres = (kod: string) => `${site}/q/${kod}`;

  async function ekle() {
    if (!baslik.trim() || !hedef.trim() || ekliyor) return;
    setEkliyor(true);

    const { error } = await sb.rpc("admin_qr_ekle", {
      p_baslik: baslik.trim(),
      p_hedef: hedef.trim(),
      p_kod: ozelKod.trim() || null,
    });
    setEkliyor(false);

    if (error) { t.error(error.message); return; }
    t.success("QR kod oluşturuldu");
    setBaslik(""); setHedef(""); setOzelKod("");
    setEkleAcik(false);
    await yukle();
  }

  async function guncelle(q: Qr, alan: Partial<Qr>) {
    const { error } = await sb.rpc("admin_qr_guncelle", {
      p_id: q.id,
      p_baslik: alan.baslik ?? null,
      p_hedef: alan.hedef ?? null,
      p_aktif: alan.aktif ?? null,
    });
    if (error) { t.error(error.message); return false; }
    await yukle();
    return true;
  }

  async function sil() {
    if (!silinecek) return;
    setSiliniyor(true);
    const { error } = await sb.rpc("admin_qr_sil", { p_id: silinecek.id });
    setSiliniyor(false);
    if (error) { t.error(error.message); return; }
    t.success("QR kod silindi");
    setSilinecek(null);
    await yukle();
  }

  /**
   * QR'ı PNG olarak indirir.
   *
   * ⚠ YÜKSEK ÇÖZÜNÜRLÜK.
   * Ekranda küçük görünse de afişte büyük basılabilir; 1024
   * piksel baskıda bozulmayacak boyut.
   */
  async function indir(q: Qr) {
    try {
      const veri = await QRCode.toDataURL(adres(q.kod), {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      const a = document.createElement("a");
      a.href = veri;
      a.download = `qr-${q.kod}.png`;
      a.click();
    } catch {
      t.error("QR indirilemedi");
    }
  }

  return (
    <div className="grid gap-5">
      {/*
        ⚠ EKLEME FORMU PENCEREDE.
        Form sürekli açık dururken sayfanın üçte birini
        kaplıyor ve asıl iş olan kod listesini aşağı itiyordu.
        Artık tek bir düğme var; form gerektiğinde açılıyor.
      */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted2">
          {liste.length > 0
            ? `${liste.length} QR kod`
            : "Henüz QR kod yok"}
        </p>
        <button
          type="button"
          onClick={() => setEkleAcik(true)}
          className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-bg"
        >
          <Icon name="plus" size={15} /> Yeni QR kod
        </button>
      </div>

      {/* ---- liste ---- */}
      {yukleniyor ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
      ) : liste.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-muted2">
          Henüz QR kod yok. Yukarıdan oluşturabilirsin.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {liste.map((q) => (
            <QrKart
              key={q.id}
              q={q}
              adres={adres(q.kod)}
              onDuzenle={() => setDuzenlenen(q)}
              onSil={() => setSilinecek(q)}
              onIndir={() => void indir(q)}
              onDurum={() => void guncelle(q, { aktif: !q.aktif })}
            />
          ))}
        </div>
      )}

      {ekleAcik && (
        <EklePenceresi
          baslik={baslik} setBaslik={setBaslik}
          hedef={hedef} setHedef={setHedef}
          ozelKod={ozelKod} setOzelKod={setOzelKod}
          ekliyor={ekliyor}
          onKapat={() => setEkleAcik(false)}
          onEkle={() => void ekle()}
        />
      )}

      {duzenlenen && (
        <DuzenlePenceresi
          q={duzenlenen}
          onKapat={() => setDuzenlenen(null)}
          onKaydet={async (baslikYeni, hedefYeni) => {
            const ok = await guncelle(duzenlenen, {
              baslik: baslikYeni, hedef: hedefYeni,
            });
            if (ok) { t.success("Güncellendi"); setDuzenlenen(null); }
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(silinecek)}
        title="QR kod silinsin mi?"
        description={
          silinecek
            ? `"${silinecek.baslik}" silinecek. Basılmış kodlar `
              + "artık çalışmaz."
            : ""
        }
        confirmLabel="Sil"
        loading={siliniyor}
        onConfirm={() => void sil()}
        onClose={() => setSilinecek(null)}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEK KART
   ══════════════════════════════════════════════════════════════ */

function QrKart({
  q, adres, onDuzenle, onSil, onIndir, onDurum,
}: {
  q: Qr; adres: string;
  onDuzenle: () => void; onSil: () => void;
  onIndir: () => void; onDurum: () => void;
}) {
  const tuval = useRef<HTMLCanvasElement>(null);

  /*
   * ⚠ QR TARAYICIDA ÜRETİLİYOR.
   * Sunucuda üretip depolamak gereksiz: adres değişmediği
   * sürece kod da aynı kalıyor ve üretimi milisaniyeler sürüyor.
   */
  useEffect(() => {
    if (!tuval.current) return;
    void QRCode.toCanvas(tuval.current, adres, {
      width: 200, margin: 1, errorCorrectionLevel: "M",
    }).catch(() => { /* çizilemezse kart yine çalışıyor */ });
  }, [adres]);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        q.aktif ? "border-line" : "border-line opacity-60"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-bold">{q.baslik}</span>
          <span className="block truncate text-[11.5px] text-muted2">{q.hedef}</span>
        </span>
        <button
          type="button"
          onClick={onDurum}
          title={q.aktif ? "Kapat" : "Aç"}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            q.aktif ? "bg-emerald-500/15 text-emerald-500" : "bg-chip text-muted2"
          }`}
        >
          {q.aktif ? "Açık" : "Kapalı"}
        </button>
      </div>

      <div className="mb-3 flex justify-center rounded-xl bg-white p-3">
        {/* Beyaz zemin şart: QR okuyucular koyu zeminde zorlanıyor */}
        <canvas ref={tuval} className="h-[168px] w-[168px]" />
      </div>

      <div className="mb-3 flex items-center justify-between text-[12px]">
        <span className="font-mono text-muted2">/q/{q.kod}</span>
        <span className="font-bold">
          {q.okunma.toLocaleString("tr-TR")} okutma
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onIndir}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[12.5px] font-semibold"
        >
          <Icon name="file" size={14} /> İndir
        </button>
        <button
          type="button"
          onClick={onDuzenle}
          aria-label="Düzenle"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line"
        >
          <Icon name="edit" size={14} />
        </button>
        <button
          type="button"
          onClick={onSil}
          aria-label="Sil"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/40 text-red-500"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DÜZENLEME PENCERESİ
   ══════════════════════════════════════════════════════════════ */

function DuzenlePenceresi({
  q, onKapat, onKaydet,
}: {
  q: Qr;
  onKapat: () => void;
  onKaydet: (baslik: string, hedef: string) => void;
}) {
  const [baslik, setBaslik] = useState(q.baslik);
  const [hedef, setHedef] = useState(q.hedef);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    const z = requestAnimationFrame(() => setAcik(true));
    return () => cancelAnimationFrame(z);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  return (
    <>
      <div
        onClick={onKapat}
        aria-hidden
        className={`fixed inset-0 z-[190] bg-black/50 transition-opacity duration-200 ${
          acik ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR kod düzenle"
        className={`kb-qr-pencere fixed z-[200] bg-surface p-5 ${acik ? "kb-acik" : ""}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">QR kodu düzenle</h2>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <label className="mb-1 block text-[12.5px] font-semibold">Başlık</label>
        <input
          value={baslik}
          onChange={(e) => setBaslik(e.target.value)}
          className="mb-4 w-full rounded-lg border border-line bg-transparent px-3 py-2 text-[13.5px]"
        />

        <label className="mb-1 block text-[12.5px] font-semibold">Hedef adres</label>
        <input
          value={hedef}
          onChange={(e) => setHedef(e.target.value)}
          inputMode="url"
          className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-[13.5px]"
        />
        <p className="mt-2 text-[12px] text-muted2">
          {/*
            ⚠ KOD DEĞİŞTİRİLEMİYOR.
            Basılmış kodlar bu kısa kodu taşıyor; değiştirmek
            onları çalışmaz hâle getirirdi.
          */}
          Kısa kod <span className="font-mono">/q/{q.kod}</span> değiştirilemez —
          basılmış kodlar çalışmaya devam etsin diye.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onKapat}
            className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => onKaydet(baslik, hedef)}
            disabled={!baslik.trim() || !hedef.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-bg disabled:opacity-40"
          >
            Kaydet
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   YENİ KOD PENCERESİ

   ⚠ DURUM ÜST BİLEŞENDE.
   Alan değerleri burada tutulsaydı pencere kapanıp açılınca
   yazılanlar kaybolurdu; ağ hatasında okur her şeyi baştan
   yazmak zorunda kalırdı.
   ══════════════════════════════════════════════════════════════ */

function EklePenceresi({
  baslik, setBaslik, hedef, setHedef, ozelKod, setOzelKod,
  ekliyor, onKapat, onEkle,
}: {
  baslik: string; setBaslik: (v: string) => void;
  hedef: string; setHedef: (v: string) => void;
  ozelKod: string; setOzelKod: (v: string) => void;
  ekliyor: boolean;
  onKapat: () => void;
  onEkle: () => void;
}) {
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    const z = requestAnimationFrame(() => setAcik(true));
    return () => cancelAnimationFrame(z);
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = eski;
    };
  }, [onKapat]);

  const gecerli = baslik.trim().length > 0 && hedef.trim().length > 0;

  return (
    <>
      <div
        onClick={onKapat}
        aria-hidden
        className={`fixed inset-0 z-[190] bg-black/50 transition-opacity duration-200 ${
          acik ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Yeni QR kod"
        className={`kb-qr-pencere fixed z-[200] bg-surface p-6 ${acik ? "kb-acik" : ""}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold">Yeni QR kod</h2>
          <button
            type="button"
            onClick={onKapat}
            aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <p className="mb-5 text-[12.5px] leading-relaxed text-muted2">
          Kodun gittiği adresi sonradan değiştirebilirsin; basılmış
          kodlar çalışmaya devam eder.
        </p>

        <label className="mb-1.5 block text-[12.5px] font-semibold">Başlık</label>
        <input
          value={baslik}
          onChange={(e) => setBaslik(e.target.value)}
          placeholder="Afiş — Merkez"
          autoFocus
          className="mb-4 w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
        />

        <label className="mb-1.5 block text-[12.5px] font-semibold">Hedef adres</label>
        <input
          value={hedef}
          onChange={(e) => setHedef(e.target.value)}
          placeholder="https://..."
          inputMode="url"
          className="mb-4 w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
        />

        <label className="mb-1.5 block text-[12.5px] font-semibold">
          Özel kod <span className="font-normal text-muted2">— isteğe bağlı</span>
        </label>
        <input
          value={ozelKod}
          onChange={(e) => setOzelKod(e.target.value.toLowerCase())}
          placeholder="kendiliğinden üretilir"
          className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
        />
        <p className="mt-2 text-[12px] text-muted2">
          Yalnızca küçük harf ve rakam. Sonradan değiştirilemez.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onKapat}
            disabled={ekliyor}
            className="rounded-lg border border-line px-4 py-2.5 text-[13px] font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onEkle}
            disabled={ekliyor || !gecerli}
            className="rounded-lg bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-40"
          >
            {ekliyor ? "Oluşturuluyor…" : "Oluştur"}
          </button>
        </div>
      </div>
    </>
  );
}
