"use client";
import { useState, useMemo, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Input, Skeleton } from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   ŞEHİR SEÇİMİ

   ┌─ AÇILIR LİSTE YETMİYORDU ⚠️ ──────────────────────────────┐
   │ Tarayıcının kendi `<select>` kutusunda 81 il + yüzlerce    │
   │ yabancı yer var. Arama yok, gruplama yok, mobilde          │
   │ kullanılamıyor.                                              │
   │                                                              │
   │ Bu pencerede: arama, plaka kodları ve Türkiye illeri        │
   │ ayrı bölümde — yabancı yerler altta.                        │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface Sehir {
  id: string;
  name: string;
  slug: string;
  plate_code: number | null;
  is_domestic: boolean;
}

export default function SehirSec({
  deger, onSec,
}: {
  deger: string;
  onSec: (id: string, ad: string) => void;
}) {
  const sb = supabaseBrowser();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Sehir[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [arama, setArama] = useState("");

  /* Liste yalnızca pencere ilk açıldığında çekiliyor */
  useEffect(() => {
    if (!acik || liste.length > 0) return;
    setYukleniyor(true);
    void (async () => {
      const { data } = await sb.rpc("admin_sehir_liste");
      setListe((data ?? []) as unknown as Sehir[]);
      setYukleniyor(false);
    })();
  }, [acik, liste.length, sb]);

  const secili = liste.find((c) => c.id === deger);

  const { yurtIci, yurtDisi } = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    const süz = (c: Sehir) =>
      !q
      || c.name.toLocaleLowerCase("tr").includes(q)
      || String(c.plate_code ?? "").startsWith(q);
    return {
      yurtIci: liste.filter((c) => c.is_domestic && süz(c)),
      yurtDisi: liste.filter((c) => !c.is_domestic && süz(c)),
    };
  }, [liste, arama]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="flex w-full items-center gap-2 rounded-[12px] border border-line2 bg-surface px-3.5 py-2.5 text-start text-[14px] transition-colors hover:border-line"
      >
        <Icon name="pin" size={16} />
        <span className={secili ? "" : "text-muted2"}>
          {secili
            ? `${secili.name}${secili.plate_code ? ` · ${secili.plate_code}` : ""}`
            : deger ? "Yükleniyor…" : "Şehir seç"}
        </span>
        {deger && (
          <span
            role="button"
            tabIndex={0}
            className="ms-auto text-[12px] text-muted2 hover:text-danger"
            onClick={(e) => { e.stopPropagation(); onSec("", ""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSec("", ""); } }}
          >
            Temizle
          </span>
        )}
      </button>

      <Modal open={acik} onClose={() => setAcik(false)} title="Şehir seç">
        <div className="flex flex-col gap-3">
          <Input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="İl adı ya da plaka kodu…"
            autoFocus
          />

          {yukleniyor ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="max-h-[52vh] overflow-y-auto">
              {yurtIci.length > 0 && (
                <>
                  <div className="kb-eyebrow sticky top-0 bg-surface py-2">
                    Türkiye · {yurtIci.length} il
                  </div>
                  {/*
                    Plaka koduyla birlikte, ızgarada. 81 ili tek
                    sütunda taramak yorucu.
                  */}
                  <div className="mb-3 grid gap-1 sm:grid-cols-2">
                    {yurtIci.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { onSec(c.id, c.name); setAcik(false); setArama(""); }}
                        className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-start text-[13.5px] transition-colors ${
                          c.id === deger ? "bg-solid text-on-solid" : "hover:bg-chip"
                        }`}
                      >
                        <span className={`kb-num w-7 shrink-0 text-[11.5px] font-bold ${
                          c.id === deger ? "opacity-80" : "text-muted2"
                        }`}>
                          {c.plate_code ?? "—"}
                        </span>
                        <span className="truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {yurtDisi.length > 0 && (
                <>
                  <div className="kb-eyebrow sticky top-0 bg-surface py-2">
                    Diğer · {yurtDisi.length}
                  </div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {yurtDisi.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { onSec(c.id, c.name); setAcik(false); setArama(""); }}
                        className={`rounded-[10px] px-3 py-2 text-start text-[13.5px] transition-colors ${
                          c.id === deger ? "bg-solid text-on-solid" : "hover:bg-chip"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {yurtIci.length === 0 && yurtDisi.length === 0 && (
                <p className="py-8 text-center text-[13.5px] text-muted">
                  &quot;{arama}&quot; bulunamadı.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
