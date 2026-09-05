"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Button, Input, Badge, EmptyState, Skeleton } from "@/components/ui";
import Icon from "@/components/ui/Icon";
import { kapakAdresi, type KapakBilgi } from "@/lib/medya-adres";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   HABER LİSTESİ

   ┌─ 222.850 HABER VAR ⚠️ ────────────────────────────────────┐
   │ Sayfalama ŞART. Hepsini çekmek tarayıcıyı kilitler.       │
   │                                                              │
   │ Toplam sayı da pahalı: `count(*)` her açılışta tabloyu     │
   │ tarıyor. Süzme yoksa yaklaşık sayı gösteriliyor            │
   │ ("~222.850"), süzme varsa gerçek sayım yapılıyor.          │
   └──────────────────────────────────────────────────────────────┘

   ┌─ KAPAK GÖRSELİ ÜÇ KADEMELİ ⚠️ ────────────────────────────┐
   │ 1. Haberin kapağı                                          │
   │ 2. Yoksa ilk hazır görsel                                  │
   │ 3. O da yoksa VİDEONUN kapak karesi                        │
   │ Böylece yalnızca videosu olan haber de görselli çıkıyor.   │
   └──────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

export interface HaberSatir {
  id: string;
  slug: string;
  title: string;
  status: string;
  source: string;
  son_dakika: boolean;
  published_at: string | null;
  created_at: string;
  media_state: string;
  has_video: boolean;
  /*
   * ⚠ ARTIK NESNE, DÜZ ANAHTAR DEĞİL.
   * Adresi kurmak için türü ve varyantları da bilmek gerekiyor;
   * yalnızca anahtarla kurulan adres 404 veriyordu.
   */
  kapak: KapakBilgi | null;
  summary: string;
  kategori: string | null;
  kategori_renk: string | null;
  sehir: string | null;
  yazar: string | null;
  yazar_username: string | null;
  kaynak: string | null;
  kaynak_slug: string | null;
  cocuk_guvenli: boolean | null;
}

const SAYFA = 24;

/*
 * ⚠ ANAHTARLAR VERİTABANI ENUM'UYLA BİREBİR OLMALI.
 *
 * Burada `review` ve `scheduled` yazıyordu; `article_status`
 * enum'unda böyle değerler YOK. Gerçek liste:
 *   draft, pending_review, published, rejected, archived
 *
 * Sonuç: yazarın gönderdiği haber `pending_review` durumunda
 * kalıyor, panelin "İncelemede" süzgeci `review` arıyor ve
 * hiçbir zaman eşleşmiyordu. Onay bekleyen haberler panelde
 * görünmüyordu.
 */
const DURUM: Record<string, { ad: string; ton: "green" | "muted" | "accent" | "danger" }> = {
  published:      { ad: "Yayında",     ton: "green" },
  draft:          { ad: "Taslak",      ton: "muted" },
  pending_review: { ad: "Onay bekliyor", ton: "accent" },
  rejected:       { ad: "Reddedildi",  ton: "danger" },
  archived:       { ad: "Arşiv",       ton: "muted" },
};

function tarih(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  const fark = (Date.now() - d.getTime()) / 1000;
  if (fark < 60) return "az önce";
  if (fark < 3600) return `${Math.floor(fark / 60)} dk önce`;
  if (fark < 86400) return `${Math.floor(fark / 3600)} saat önce`;
  if (fark < 604800) return `${Math.floor(fark / 86400)} gün önce`;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function HaberListe({ cdnBase }: { cdnBase: string }) {
  const sb = supabaseBrowser();
  const t = useToast();
  const cdn = cdnBase.replace(/\/+$/, "");

  const [satirlar, setSatirlar] = useState<HaberSatir[]>([]);
  const [toplam, setToplam] = useState(0);
  const [yaklasik, setYaklasik] = useState(true);
  const [sayfa, setSayfa] = useState(0);
  const [arama, setArama] = useState("");
  const [durum, setDurum] = useState<string>("");
  const [yukleniyor, setYukleniyor] = useState(true);

  /*
   * Arama her tuşta sorgu atmasın: 400 ms bekleniyor.
   * 222.850 satırlık aramada her harf için istek atmak
   * hem sunucuyu hem kullanıcıyı yorar.
   */
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gecikmeliArama, setGecikmeliArama] = useState("");

  useEffect(() => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => {
      setGecikmeliArama(arama);
      setSayfa(0);
    }, 400);
    return () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); };
  }, [arama]);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const { data, error } = await sb.rpc("admin_haber_liste", {
      p: {
        limit: SAYFA,
        offset: sayfa * SAYFA,
        ...(gecikmeliArama.trim() ? { q: gecikmeliArama.trim() } : {}),
        ...(durum ? { status: durum } : {}),
      },
    });
    setYukleniyor(false);
    if (error) { t.error("Haberler okunamadı: " + error.message); return; }

    const o = data as { satirlar: HaberSatir[]; toplam: number; yaklasik: boolean } | null;
    setSatirlar(o?.satirlar ?? []);
    setToplam(o?.toplam ?? 0);
    setYaklasik(o?.yaklasik ?? true);
  }, [sb, t, sayfa, gecikmeliArama, durum]);

  useEffect(() => { void yukle(); }, [yukle]);

  const sonSayfa = Math.max(0, Math.ceil(toplam / SAYFA) - 1);

  return (
    <div className="flex flex-col gap-4">
      {/*
        ⚠ ARTI BUTONU SABİT DEĞİL.
        Önce `position: fixed` ile ekranda asılı duruyordu;
        mobilde header'ın altına giriyor ve kaydırınca içeriğin
        üstünü kapatıyordu. Artık normal akışta, araç
        çubuğunun sağ ucunda.
      */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-[200px] flex-1">
          <Input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Başlıkta ara ya da haber kodu…"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[["", "Tümü"], ["pending_review", "Onay bekliyor"],
            ["published", "Yayında"], ["draft", "Taslak"],
            ["rejected", "Reddedildi"]].map(([d, ad]) => (
            <button
              key={d}
              type="button"
              onClick={() => { setDurum(d); setSayfa(0); }}
              className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                durum === d ? "bg-solid text-on-solid" : "bg-chip text-ink2 hover:text-ink"
              }`}
            >
              {ad}
            </button>
          ))}
        </div>

        <Link
          href="/haberler/yeni"
          aria-label="Yeni haber"
          title="Yeni haber"
          className="kb-lift ms-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-solid text-on-solid"
        >
          <Icon name="plus" size={19} />
        </Link>
      </div>

      <div className="kb-num flex items-center gap-2 px-1 text-[12.5px] text-muted2">
        {yaklasik ? "~" : ""}{toplam.toLocaleString("tr-TR")} haber
        {toplam > SAYFA && ` · sayfa ${sayfa + 1} / ${sonSayfa + 1}`}
      </div>

      {/* ── Liste ── */}
      {yukleniyor ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : satirlar.length === 0 ? (
        <EmptyState
          title="Haber bulunamadı"
          description={gecikmeliArama ? "Aramanı değiştirmeyi dene." : undefined}
        />
      ) : (
        /*
          ⚠ DİKEY LİSTE, IZGARA DEĞİL.
          Haber sitesi düzeni: geniş kapak solda, başlık ve künye
          sağda. Izgarada başlıklar kırpılıyor, tarama zorlaşıyordu.
        */
        <div className="flex flex-col gap-1">
          {satirlar.map((h) => {
            const d = DURUM[h.status] ?? { ad: h.status, ton: "muted" as const };
            const gorsel = kapakAdresi(h.kapak, cdn, "card");
            return (
              <Link
                key={h.id}
                href={`/haberler/${h.id}`}
                className="group flex gap-3.5 rounded-[16px] p-2.5 transition-colors hover:bg-chip sm:gap-4 sm:p-3"
              >
                {/* Kapak */}
                <span
                  className="relative block w-28 shrink-0 overflow-hidden rounded-[12px] sm:w-44"
                  style={{
                    aspectRatio: "16 / 10",
                    background: h.kapak?.dominant_color ?? "var(--chip)",
                  }}
                >
                  {gorsel ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={gorsel}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        /*
                         * Adres yine de tutmazsa kırık ikon yerine
                         * boş zemin kalsın — liste düzgün görünsün.
                         */
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted2">
                      <Icon name="media" size={18} />
                    </span>
                  )}

                  {h.has_video && (
                    <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white">
                      <Icon name="play" size={11} />
                    </span>
                  )}
                </span>

                {/* Metin */}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={d.ton}>{d.ad}</Badge>
                    {h.son_dakika && <Badge tone="danger">Son dakika</Badge>}
                    {h.kategori && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white"
                        style={{ background: h.kategori_renk ?? "var(--solid)" }}
                      >
                        {h.kategori}
                      </span>
                    )}
                    {h.cocuk_guvenli === false && <Badge tone="danger">18+</Badge>}
                  </span>

                  <span className="line-clamp-2 text-[14.5px] font-semibold leading-snug">
                    {h.title}
                  </span>

                  {h.summary && (
                    <span className="line-clamp-1 hidden text-[12.5px] leading-relaxed text-muted sm:block">
                      {h.summary}
                    </span>
                  )}

                  <span className="kb-num mt-auto flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted2">
                    <span>{tarih(h.published_at ?? h.created_at)}</span>
                    {h.yazar && <><span>·</span><span className="truncate">{h.yazar}</span></>}
                    {h.kaynak && h.kaynak !== h.yazar && <><span>·</span><span>{h.kaynak}</span></>}
                    {h.sehir && <><span>·</span><span>{h.sehir}</span></>}
                  </span>
                </span>

                {/* Hızlı düzenle — ikon, mobilde de görünür */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Düzenle"
                  title="Düzenle"
                  className="flex shrink-0 items-center self-center"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `/haberler/${h.id}/duzenle`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    window.location.href = `/haberler/${h.id}/duzenle`;
                  }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:bg-solid hover:text-on-solid">
                    <Icon name="edit" size={15} />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Sayfalama ── */}
      {toplam > SAYFA && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="ghost" size="sm"
            disabled={sayfa === 0}
            onClick={() => { setSayfa((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0 }); }}>
            <Icon name="chevronLeft" size={16} /> Önceki
          </Button>
          <span className="kb-num px-3 text-[13px] text-muted">
            {sayfa + 1} / {sonSayfa + 1}
          </span>
          <Button variant="ghost" size="sm"
            disabled={sayfa >= sonSayfa}
            onClick={() => { setSayfa((s) => s + 1); window.scrollTo({ top: 0 }); }}>
            Sonraki <Icon name="chevronRight" size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
