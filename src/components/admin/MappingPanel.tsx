"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Tabs, Select, Input, Badge, Alert,
  EmptyState, Skeleton, StatCard, TableWrap, Table, Th, Td,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   KATEGORİ VE ŞEHİR EŞLEŞTİRME

   Bot İHA'dan gelen ham adları (`ULUSAL HABER / SPOR`, `TRABZON`)
   keşfedip `category_mappings` / `city_mappings` tablolarına
   yazıyor. Burada onları gerçek kategoriye/şehre bağlıyoruz.

   ┌─ EŞLEŞMİŞLER DE LİSTELENİYOR ⚠️ ────────────────────────────┐
   │ Eskiden yalnızca BEKLEYENLER görünüyordu. Bir kategori       │
   │ yanlış eşleştirildiyse kuyruktan düşüyor ve bir daha         │
   │ görünmüyordu — düzeltmek için SQL yazmak gerekiyordu.        │
   │                                                                │
   │ Artık iki sekme var: bekleyen ve eşleşmiş. Eşleşmişin        │
   │ hedefi değiştirilebilir ya da eşleştirme kaldırılabilir.      │
   └────────────────────────────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════ */

interface KatSatir {
  id: string;
  raw_ust: string | null;
  raw_kategori: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  hit_count: number;
  last_seen_at: string | null;
  mapped_by_name: string;
  source_name: string | null;
  eslesti: boolean;
  haber_sayisi: number;
}

interface SehirSatir {
  id: string;
  raw_sehir: string | null;
  raw_key: string | null;
  city_id: string | null;
  city_name: string | null;
  plate_code: number | null;
  hit_count: number;
  last_seen_at: string | null;
  mapped_by_name: string;
  source_name: string | null;
  eslesti: boolean;
  haber_sayisi: number;
}

export interface MappingStats {
  bekleyen_kategori: number;
  eslesen_kategori: number;
  bekleyen_sehir: number;
  eslesen_sehir: number;
  kategorisiz_haber: number;
  sehirsiz_haber: number;
}

export interface Secenek { id: string; name: string }

export default function MappingPanel({
  catOptions, cityOptions,
}: {
  catOptions: Secenek[];
  cityOptions: Secenek[];
}) {
  const sb = supabaseBrowser();
  const toast = useToast();

  const [tur, setTur] = useState<"kategori" | "sehir">("kategori");
  const [durum, setDurum] = useState<"bekleyen" | "eslesen">("bekleyen");
  const [arama, setArama] = useState("");

  const [kats, setKats] = useState<KatSatir[]>([]);
  const [sehirler, setSehirler] = useState<SehirSatir[]>([]);
  const [stats, setStats] = useState<MappingStats | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mesgul, setMesgul] = useState<string | null>(null);

  const [kaldirilacak, setKaldirilacak] = useState<{ id: string; ad: string } | null>(null);
  const [remapCalisiyor, setRemapCalisiyor] = useState(false);
  const [dolduruyor, setDolduruyor] = useState(false);

  /**
   * Eşleştirme tablosunu haberlerden doldur.
   *
   * ⚠ NEDEN GEREKLİ: `category_mappings` tablosunu normalde BOT
   * dolduruyor — yeni bir ham kategori adı görünce kaydediyor.
   * Eski veritabanından aktarılan haberler bottan geçmediği için
   * tabloya hiç kayıt girmedi ve bu ekran bomboş görünüyordu.
   */
  async function doldur() {
    setDolduruyor(true);
    const { data, error } = await sb.rpc("gecis_eslestirme_doldur");
    setDolduruyor(false);
    if (error) { toast.error(error.message); return; }
    const o = data as { kategori: number; sehir: number } | null;
    toast.success(
      o && (o.kategori + o.sehir > 0)
        ? `${o.kategori} kategori, ${o.sehir} şehir eklendi`
        : "Eklenecek yeni ad bulunamadı",
    );
    await yukle();
  }

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const [k, c, st] = await Promise.all([
      sb.from("admin_category_mappings").select("*")
        .order("hit_count", { ascending: false }).limit(300),
      sb.from("admin_city_mappings").select("*")
        .order("hit_count", { ascending: false }).limit(300),
      sb.from("admin_mapping_stats").select("*").maybeSingle(),
    ]);
    setYukleniyor(false);
    if (k.error) { toast.error("Kategoriler okunamadı: " + k.error.message); return; }
    setKats((k.data ?? []) as unknown as KatSatir[]);
    setSehirler((c.data ?? []) as unknown as SehirSatir[]);
    setStats((st.data as unknown as MappingStats) ?? null);
  }, [sb, toast]);

  useEffect(() => { void yukle(); }, [yukle]);

  async function esle(id: string, hedef: string, kategoriMi: boolean) {
    if (!hedef) return;
    setMesgul(id);
    const { error } = await sb.rpc(
      kategoriMi ? "admin_map_category" : "admin_map_city",
      kategoriMi
        ? { p_mapping_id: id, p_category_id: hedef }
        : { p_mapping_id: id, p_city_id: hedef },
    );
    setMesgul(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Eşleştirildi — geçmiş haberler de güncellendi");
    await yukle();
  }

  async function kaldir() {
    if (!kaldirilacak) return;
    const kategoriMi = tur === "kategori";
    const { error } = await sb.rpc(
      kategoriMi ? "admin_unmap_category" : "admin_unmap_city",
      { p_id: kaldirilacak.id },
    );
    setKaldirilacak(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Eşleştirme kaldırıldı — kayıt bekleyenlere döndü");
    await yukle();
  }

  /**
   * Geçmiş haberleri yeniden eşleştir.
   *
   * Sayfa sayfa çalışır: tek sorguda 50.000 satır güncellemek
   * kilitlenmeye yol açardı. Sıfır dönene kadar tekrarlanır.
   */
  async function remap() {
    setRemapCalisiyor(true);
    let toplam = 0;
    for (let tur = 0; tur < 30; tur++) {
      const { data, error } = await sb.rpc("admin_remap_articles", { p_limit: 2000 });
      if (error) { toast.error(error.message); break; }
      const n = Number(data ?? 0);
      toplam += n;
      if (n === 0) break;
    }
    setRemapCalisiyor(false);
    toast.success(
      toplam > 0
        ? `${toplam} haber yeniden eşleştirildi`
        : "Eşleştirilecek haber kalmadı",
    );
    await yukle();
  }

  // ---- Süzme ----
  const gorunen = useMemo(() => {
    const a = arama.trim().toLowerCase();
    if (tur === "kategori") {
      return kats.filter((r) =>
        r.eslesti === (durum === "eslesen") &&
        (!a ||
          (r.raw_kategori ?? "").toLowerCase().includes(a) ||
          (r.raw_ust ?? "").toLowerCase().includes(a) ||
          (r.category_name ?? "").toLowerCase().includes(a)),
      );
    }
    return sehirler.filter((r) =>
      r.eslesti === (durum === "eslesen") &&
      (!a ||
        (r.raw_sehir ?? "").toLowerCase().includes(a) ||
        (r.city_name ?? "").toLowerCase().includes(a)),
    );
  }, [tur, durum, arama, kats, sehirler]);

  const secenekler = tur === "kategori" ? catOptions : cityOptions;

  if (yukleniyor) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Durum ── */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Bekleyen kategori" value={stats.bekleyen_kategori}
            tone={stats.bekleyen_kategori > 0 ? "orange" : "neutral"} />
          <StatCard label="Bekleyen şehir" value={stats.bekleyen_sehir}
            tone={stats.bekleyen_sehir > 0 ? "orange" : "neutral"} />
          <StatCard label="Kategorisiz haber" value={stats.kategorisiz_haber}
            hint="eşleştirme sonrası düşer" />
          <StatCard label="Şehirsiz haber" value={stats.sehirsiz_haber} />
        </div>
      )}

      {(stats?.kategorisiz_haber ?? 0) > 0 && (
        <Alert tone="muted" title="Geçmiş haberler">
          Eşleştirme yaptığında yalnızca YENİ haberler değil, o ana kadar
          kategorisi boş kalmış geçmiş haberler de güncellenir. Eski bir
          eşleştirmeyi değiştirdiysen aşağıdaki düğmeyle tümünü yeniden
          uygulayabilirsin.
        </Alert>
      )}

      {/* ── Sekmeler ── */}
      <Tabs
        value={tur}
        onChange={(k) => setTur(k as typeof tur)}
        items={[
          { key: "kategori", label: "Kategoriler", badge: stats?.bekleyen_kategori || undefined },
          { key: "sehir", label: "Şehirler", badge: stats?.bekleyen_sehir || undefined },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <Tabs
          value={durum}
          onChange={(k) => setDurum(k as typeof durum)}
          items={[
            { key: "bekleyen", label: "Bekleyen" },
            { key: "eslesen", label: "Eşleştirilmiş" },
          ]}
        />
        <div className="min-w-[200px] flex-1">
          <Input value={arama} onChange={(e) => setArama(e.target.value)}
            placeholder="Ham ad ya da hedefte ara" />
        </div>
        <Button variant="outline" size="sm" onClick={doldur} loading={dolduruyor}>
          <Icon name="plus" size={15} /> Haberlerden tara
        </Button>
        <Button variant="outline" size="sm" onClick={remap} loading={remapCalisiyor}>
          <Icon name="refresh" size={15} /> Geçmişe uygula
        </Button>
      </div>

      {/* ── Liste ── */}
      {gorunen.length === 0 ? (
        <EmptyState
          title={
            durum === "bekleyen"
              ? "Bekleyen eşleştirme yok"
              : "Henüz eşleştirme yapılmamış"
          }
          description={
            durum === "bekleyen"
              ? "Bot yeni bir ad keşfettiğinde burada listelenir. " +
                "Eski veritabanından haber aktardıysan \"Haberlerden tara\" " +
                "düğmesine bas — aktarılan haberlerin kategori adları buraya gelir."
              : undefined
          }
        />
      ) : (
        <Card className="p-5">
          <CardHead
            title={`${gorunen.length} kayıt`}
            desc={
              durum === "bekleyen"
                ? "En çok görülen üstte. Hedef seçince geçmiş haberler de güncellenir."
                : "Hedefi değiştirebilir ya da eşleştirmeyi kaldırabilirsin."
            }
          />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Kaynaktan gelen</Th>
                  <Th align="end">Görülme</Th>
                  <Th align="end">Haber</Th>
                  <Th>Hedef</Th>
                  <Th align="end" />
                </tr>
              </thead>
              <tbody>
                {gorunen.map((r) => {
                  const kategoriMi = tur === "kategori";
                  const k = r as KatSatir;
                  const c = r as SehirSatir;

                  const hamAd = kategoriMi
                    ? (k.raw_kategori ?? "(boş)")
                    : (c.raw_sehir ?? "(boş)");
                  const ustAd = kategoriMi ? k.raw_ust : null;
                  const hedefId = kategoriMi ? k.category_id : c.city_id;
                  const hedefAd = kategoriMi ? k.category_name : c.city_name;

                  return (
                    <tr key={r.id}>
                      <Td>
                        <span className="font-mono text-[13px] font-semibold">{hamAd}</span>
                        {ustAd && (
                          <span className="mt-0.5 block text-[12px] text-muted2">
                            {ustAd}
                          </span>
                        )}
                        {r.source_name && (
                          <Badge tone="muted" className="mt-1">{r.source_name}</Badge>
                        )}
                      </Td>
                      <Td align="end" className="kb-num text-muted">{r.hit_count}</Td>
                      <Td align="end" className="kb-num text-muted">{r.haber_sayisi}</Td>
                      <Td>
                        <Select
                          value={hedefId ?? ""}
                          disabled={mesgul === r.id}
                          onChange={(e) => esle(r.id, e.target.value, kategoriMi)}
                          className="min-w-[180px]"
                        >
                          <option value="">— seç —</option>
                          {secenekler.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </Select>
                        {r.eslesti && (
                          <span className="mt-1 block text-[11.5px] text-muted2">
                            {r.mapped_by_name}
                          </span>
                        )}
                      </Td>
                      <Td align="end">
                        {r.eslesti && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setKaldirilacak({
                              id: r.id, ad: `${hamAd} → ${hedefAd ?? "?"}`,
                            })}
                          >
                            Kaldır
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(kaldirilacak)}
        onClose={() => setKaldirilacak(null)}
        title="Eşleştirme kaldırılsın mı?"
        description={
          `${kaldirilacak?.ad ?? ""} — kayıt silinmez, bekleyenlere döner. ` +
          "Bu ada sahip haberler kategorisiz kalır."
        }
        confirmLabel="Kaldır"
        onConfirm={kaldir}
      />
    </div>
  );
}
