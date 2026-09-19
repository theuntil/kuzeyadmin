"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/* ══════════════════════════════════════════════════════════════
   SAKINCALI İÇERİK FİLTRESİ

   Yorumlar anında yayına giriyor; yalnızca burada tanımlı
   terimlerden birini içerenler incelemeye düşüyor.

   ⚠ SÖZLÜK YALNIZCA YÖNETİCİDE.
   Liste okunabilseydi hangi sözcüklerin yakalandığı görülür ve
   filtre kolayca atlatılırdı.
   ══════════════════════════════════════════════════════════════ */

type Terim = {
  id: string;
  term: string;
  kategori: string;
  eslesme: string;
  aktif: boolean;
  not_metni: string | null;
};

const KATEGORI: Record<string, string> = {
  teror: "Terör",
  kufur: "Küfür / hakaret",
  cinsellik: "Cinsellik",
  cocuk: "Çocuk istismarı",
  nefret: "Nefret / tehdit",
  diger: "Diğer",
};

const ESLESME: Record<string, string> = {
  sozcuk: "Tam sözcük",
  parca: "İçinde geçsin",
  regex: "Desen (regex)",
};

export default function FiltrePanel() {
  const [liste, setListe] = useState<Terim[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const [yeniTerim, setYeniTerim] = useState("");
  const [yeniKategori, setYeniKategori] = useState("kufur");
  const [yeniEslesme, setYeniEslesme] = useState("sozcuk");
  const [ekliyor, setEkliyor] = useState(false);

  const [deneme, setDeneme] = useState("");
  const [sonuc, setSonuc] = useState<string | null>(null);

  const getir = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("admin_filtre_liste");
    setYukleniyor(false);
    if (error) { setHata(error.message); return; }
    setListe((data ?? []) as Terim[]);
  }, []);

  useEffect(() => { void getir(); }, [getir]);

  async function ekle() {
    const t = yeniTerim.trim();
    if (!t) return;
    setEkliyor(true);
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("admin_filtre_ekle", {
      p_term: t, p_kategori: yeniKategori, p_eslesme: yeniEslesme, p_not: null,
    });
    setEkliyor(false);
    if (error) { setHata(error.message); return; }
    setYeniTerim("");
    void getir();
  }

  async function sil(id: string) {
    /*
     * ⚠ İYİMSER SİLME.
     * Sunucu yanıtını beklemek listede takılma hissi veriyordu.
     * Hata dönerse liste yeniden çekiliyor.
     */
    setListe((l) => l.filter((x) => x.id !== id));
    const sb = supabaseBrowser();
    const { error } = await sb.rpc("admin_filtre_sil", { p_id: id });
    if (error) { setHata(error.message); void getir(); }
  }

  async function dene() {
    if (!deneme.trim()) { setSonuc(null); return; }
    const sb = supabaseBrowser();
    const { data, error } = await sb.rpc("admin_filtre_dene", { p_metin: deneme });
    if (error) { setSonuc(error.message); return; }

    const d = data as {
      riskli?: boolean; kategoriler?: string[];
      terimler?: string[]; normalize?: string;
    };
    setSonuc(
      d.riskli
        ? `İNCELEMEYE DÜŞER — ${(d.terimler ?? []).join(", ")} `
          + `(${(d.kategoriler ?? []).map((k) => KATEGORI[k] ?? k).join(", ")})`
        : `Anında yayımlanır. Çözümlenen metin: "${d.normalize ?? ""}"`,
    );
  }

  const gruplu = liste.reduce<Record<string, Terim[]>>((acc, t) => {
    (acc[t.kategori] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="grid gap-4">
      {hata && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px]">
          {hata}
        </div>
      )}

      {/* ---- deneme kutusu ---- */}
      <div className="rounded-xl border border-line p-4">
        <div className="mb-1 text-[13px] font-bold">Metin dene</div>
        <p className="mb-3 text-[12px] text-muted2">
          Bir yorumun neden incelemeye düştüğünü buradan görebilirsin.
          Hiçbir şey kaydedilmez.
        </p>
        <div className="flex gap-2">
          <input
            value={deneme}
            onChange={(e) => setDeneme(e.target.value)}
            placeholder="Örnek bir yorum yazın"
            className="flex-1 rounded-lg border border-line bg-transparent px-3 py-2 text-[13px]"
          />
          <button
            type="button"
            onClick={() => void dene()}
            className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold"
          >
            Dene
          </button>
        </div>
        {sonuc && (
          <div className="mt-3 rounded-lg bg-surface2 px-3 py-2 text-[12.5px]">
            {sonuc}
          </div>
        )}
      </div>

      {/* ---- yeni terim ---- */}
      <div className="rounded-xl border border-line p-4">
        <div className="mb-3 text-[13px] font-bold">Terim ekle</div>
        <div className="flex flex-wrap gap-2">
          <input
            value={yeniTerim}
            onChange={(e) => setYeniTerim(e.target.value)}
            placeholder="Sözcük"
            className="min-w-[160px] flex-1 rounded-lg border border-line bg-transparent px-3 py-2 text-[13px]"
          />
          <select
            value={yeniKategori}
            onChange={(e) => setYeniKategori(e.target.value)}
            className="rounded-lg border border-line bg-transparent px-3 py-2 text-[13px]"
          >
            {Object.entries(KATEGORI).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={yeniEslesme}
            onChange={(e) => setYeniEslesme(e.target.value)}
            className="rounded-lg border border-line bg-transparent px-3 py-2 text-[13px]"
          >
            {Object.entries(ESLESME).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void ekle()}
            disabled={ekliyor || !yeniTerim.trim()}
            className="rounded-lg bg-fg px-4 py-2 text-[12.5px] font-bold text-bg disabled:opacity-50"
          >
            {ekliyor ? "…" : "Ekle"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted2">
          <strong>Tam sözcük</strong> güvenlidir: &quot;salak&quot; eklenince
          &quot;salakça&quot; yakalanmaz ama yanlış alarm da vermez.{" "}
          <strong>İçinde geçsin</strong> daha geniş yakalar; masum sözcükleri
          de vurabilir, dikkatli kullanın.
        </p>
      </div>

      {/* ---- liste ---- */}
      {yukleniyor ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-surface2" />
          ))}
        </div>
      ) : (
        Object.entries(gruplu).map(([kat, terimler]) => (
          <div key={kat} className="rounded-xl border border-line p-4">
            <div className="mb-3 text-[13px] font-bold">
              {KATEGORI[kat] ?? kat}{" "}
              <span className="font-normal text-muted2">({terimler.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {terimler.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[12.5px]"
                >
                  <span className="font-semibold">{t.term}</span>
                  <span className="text-muted2">{ESLESME[t.eslesme] ?? t.eslesme}</span>
                  <button
                    type="button"
                    onClick={() => void sil(t.id)}
                    aria-label={`${t.term} terimini sil`}
                    className="text-muted2 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
