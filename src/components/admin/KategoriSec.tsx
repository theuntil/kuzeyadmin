"use client";
import { useState, useEffect, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Input, Skeleton } from "@/components/ui";
import Icon from "@/components/ui/Icon";

/**
 * KATEGORİ SEÇİMİ
 *
 * Şehir seçicisiyle aynı desen: arama var, renkleri görünüyor,
 * mobilde kullanılabiliyor. Tarayıcının `<select>` kutusunda
 * kategori rengi gösterilemiyordu.
 */
interface Kategori {
  id: string; name: string; slug: string;
  color: string | null; kind: string | null;
}

export default function KategoriSec({
  deger, onSec,
}: {
  deger: string;
  onSec: (id: string) => void;
}) {
  const sb = supabaseBrowser();
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<Kategori[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [arama, setArama] = useState("");

  useEffect(() => {
    if (liste.length > 0) return;
    setYukleniyor(true);
    void (async () => {
      const { data } = await sb.from("categories")
        .select("id, name, slug, color, kind")
        .eq("is_active", true).order("sort_order");
      setListe((data ?? []) as unknown as Kategori[]);
      setYukleniyor(false);
    })();
  }, [liste.length, sb]);

  const secili = liste.find((k) => k.id === deger);
  const q = arama.trim().toLocaleLowerCase("tr");
  const suz = useMemo(
    () => liste.filter((k) => !q || k.name.toLocaleLowerCase("tr").includes(q)),
    [liste, q]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="flex w-full items-center gap-2.5 rounded-[12px] border border-line2 bg-surface px-3 py-2.5 text-start transition-colors hover:border-line"
      >
        <span className="h-3.5 w-3.5 shrink-0 rounded-full"
          style={{ background: secili?.color ?? "var(--chip)" }} />
        <span className={`min-w-0 flex-1 truncate text-[13.5px] ${secili ? "" : "text-muted2"}`}>
          {secili?.name ?? "Kategori seç"}
        </span>
        {deger && (
          <span
            role="button" tabIndex={0}
            className="text-[12px] text-muted2 hover:text-danger"
            onClick={(e) => { e.stopPropagation(); onSec(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSec(""); } }}
          >
            Temizle
          </span>
        )}
        <Icon name="chevronRight" size={15} />
      </button>

      <Modal open={acik} onClose={() => setAcik(false)} title="Kategori seç">
        <div className="flex flex-col gap-3">
          <Input value={arama} onChange={(e) => setArama(e.target.value)}
            placeholder="Kategori ara…" autoFocus />
          {yukleniyor ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="grid max-h-[52vh] gap-1 overflow-y-auto sm:grid-cols-2">
              {suz.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => { onSec(k.id); setAcik(false); setArama(""); }}
                  className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-start transition-colors ${
                    k.id === deger ? "bg-solid text-on-solid" : "hover:bg-chip"
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: k.color ?? "var(--chip)" }} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{k.name}</span>
                  {k.id === deger && <Icon name="check" size={15} />}
                </button>
              ))}
              {suz.length === 0 && (
                <p className="col-span-full py-8 text-center text-[13.5px] text-muted">
                  Sonuç yok.
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
