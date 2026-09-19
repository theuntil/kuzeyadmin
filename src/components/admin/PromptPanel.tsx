"use client";
import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";
import {
  Button, Card, CardHead, Tabs, Field, Input, Textarea, Select,
  Switch, Badge, Alert, EmptyState, Skeleton, Divider, SaveBar,
  TableWrap, Table, Th, Td,
} from "@/components/ui";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   AI PROMPT VE ÇIKTI ŞEMASI

   İki şey yönetiliyor:

   1. PROMPT — modele ne söylediğimiz. Versiyonlu: her kayıt yeni
      sürüm açar, üstüne yazmaz. Kötü bir prompt canlıya çıkarsa
      eskiye dönmenin tek güvenli yolu bu.

   2. ÇIKTI ŞEMASI — modelin ne döndüreceği. Çekirdek dört alan
      (özet, önem, çocuk güvenliği, Instagram) sabit; üstüne
      panelden alan eklenebiliyor. Şema metni veritabanında
      üretiliyor ve prompt'taki `{{sema}}` yerine giriyor —
      yani alan eklediğinde prompt kendiliğinden güncelleniyor,
      elle düzenlemene gerek yok.
   ══════════════════════════════════════════════════════════════ */

interface PromptRow {
  id: string;
  anahtar: string;
  versiyon: number;
  sistem: string;
  sablon: string;
  aciklama: string | null;
  is_active: boolean;
  created_at: string;
  created_by_name: string;
  kullanim_sayisi: number;
}

interface FieldRow {
  id: string;
  anahtar: string;
  etiket: string;
  tip: string;
  aciklama: string;
  min_deger: number | null;
  max_deger: number | null;
  max_oge: number;
  zorunlu: boolean;
  is_active: boolean;
  sort_order: number;
  dolu_haber: number;
}

const TIPLER = [
  { v: "metin", l: "Kısa metin" },
  { v: "uzun_metin", l: "Uzun metin" },
  { v: "sayi", l: "Sayı" },
  { v: "evet_hayir", l: "Evet / hayır" },
  { v: "liste", l: "Liste" },
];

const BOS_ALAN = {
  id: "",
  anahtar: "",
  etiket: "",
  tip: "metin",
  aciklama: "",
  min_deger: null as number | null,
  max_deger: null as number | null,
  max_oge: 6,
  zorunlu: false,
  is_active: true,
  sort_order: 100,
};

export default function PromptPanel() {
  const sb = supabaseBrowser();
  const toast = useToast();

  const [bolum, setBolum] = useState<"analiz" | "ceviri" | "sema">("analiz");
  const [yukleniyor, setYukleniyor] = useState(true);

  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [alanlar, setAlanlar] = useState<FieldRow[]>([]);
  const [sema, setSema] = useState("");

  // Düzenlenen prompt metni
  const [sistem, setSistem] = useState("");
  const [sablon, setSablon] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [ilkHal, setIlkHal] = useState({ sistem: "", sablon: "" });
  const [kaydediyor, setKaydediyor] = useState(false);

  // Önizleme
  const [onizleme, setOnizleme] = useState<{ sistem: string; kullanici: string; haber: string } | null>(null);
  const [onizlemeYukleniyor, setOnizlemeYukleniyor] = useState(false);

  // Alan düzenleme
  const [duzenlenen, setDuzenlenen] = useState<typeof BOS_ALAN | null>(null);
  const [silinecek, setSilinecek] = useState<FieldRow | null>(null);
  const [veriyiSil, setVeriyiSil] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    const [p, f, s] = await Promise.all([
      sb.from("admin_prompts").select("*").order("anahtar").order("versiyon", { ascending: false }),
      sb.from("admin_ai_fields").select("*").order("sort_order"),
      sb.rpc("ai_json_sema"),
    ]);
    if (p.error) toast.error("Promptlar okunamadı: " + p.error.message);
    if (f.error) toast.error("Alanlar okunamadı: " + f.error.message);

    setPrompts((p.data ?? []) as PromptRow[]);
    setAlanlar((f.data ?? []) as FieldRow[]);
    setSema(typeof s.data === "string" ? s.data : "");
    setYukleniyor(false);
  }, [sb, toast]);

  useEffect(() => { void yukle(); }, [yukle]);

  /* Bölüm değişince o anahtarın AKTİF sürümünü forma yükle */
  useEffect(() => {
    if (bolum === "sema") return;
    const aktif = prompts.find((p) => p.anahtar === bolum && p.is_active)
               ?? prompts.find((p) => p.anahtar === bolum);
    setSistem(aktif?.sistem ?? "");
    setSablon(aktif?.sablon ?? "");
    setAciklama("");
    setIlkHal({ sistem: aktif?.sistem ?? "", sablon: aktif?.sablon ?? "" });
    setOnizleme(null);
  }, [bolum, prompts]);

  const kirli = sistem !== ilkHal.sistem || sablon !== ilkHal.sablon;

  async function promptKaydet(etkinlestir: boolean) {
    if (!sistem.trim() || !sablon.trim()) {
      toast.error("Sistem ve şablon metni boş olamaz");
      return;
    }
    setKaydediyor(true);
    const { error } = await sb.rpc("admin_prompt_save", {
      p: { anahtar: bolum, sistem, sablon, aciklama: aciklama || null, etkinlestir },
    });
    setKaydediyor(false);
    if (error) { toast.error(error.message); return; }
    toast.success(etkinlestir ? "Yeni sürüm kaydedildi ve etkinleştirildi" : "Yeni sürüm kaydedildi");
    await yukle();
  }

  async function surumEtkinlestir(id: string) {
    const { error } = await sb.rpc("ai_activate_prompt", { p_prompt_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Sürüm etkinleştirildi");
    await yukle();
  }

  async function onizlemeAl() {
    const aktif = prompts.find((p) => p.anahtar === bolum && p.is_active);
    if (!aktif) { toast.error("Önce bir sürüm kaydet"); return; }
    setOnizlemeYukleniyor(true);
    const { data, error } = await sb.rpc("admin_prompt_preview", { p_prompt_id: aktif.id });
    setOnizlemeYukleniyor(false);
    if (error) { toast.error(error.message); return; }
    const r = Array.isArray(data) ? data[0] : data;
    if (!r) { toast.error("Örnek haber bulunamadı"); return; }
    setOnizleme({ sistem: r.sistem, kullanici: r.kullanici, haber: r.ornek_haber });
  }

  async function alanKaydet() {
    if (!duzenlenen) return;
    const { error } = await sb.rpc("admin_ai_field_upsert", { p: duzenlenen });
    if (error) { toast.error(error.message); return; }
    toast.success(duzenlenen.id ? "Alan güncellendi" : "Alan eklendi");
    setDuzenlenen(null);
    await yukle();
  }

  async function alanAcKapa(f: FieldRow, acik: boolean) {
    const { error } = await sb.rpc("admin_ai_field_upsert", {
      p: { id: f.id, is_active: acik },
    });
    if (error) { toast.error(error.message); return; }
    await yukle();
  }

  async function alanSil() {
    if (!silinecek) return;
    const { error } = await sb.rpc("admin_ai_field_delete", {
      p_id: silinecek.id, p_veriyi_sil: veriyiSil,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Alan silindi");
    setSilinecek(null); setVeriyiSil(false);
    await yukle();
  }

  const surumler = prompts.filter((p) => p.anahtar === bolum);

  if (yukleniyor) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={bolum}
        onChange={(k) => setBolum(k as typeof bolum)}
        items={[
          { key: "analiz", label: "Analiz promptu" },
          { key: "ceviri", label: "Çeviri promptu" },
          { key: "sema", label: "Çıktı alanları", badge: alanlar.filter((a) => a.is_active).length },
        ]}
      />

      {/* ══════════════ PROMPT DÜZENLEME ══════════════ */}
      {bolum !== "sema" && (
        <div className="kb-stagger flex flex-col gap-5">
          <Alert tone="muted">
            Her kayıt <strong>yeni sürüm</strong> açar, üstüne yazmaz. Beğenmezsen
            aşağıdaki listeden eskisine dönebilirsin. Şablonda{" "}
            <code className="rounded bg-chip px-1">{"{{sema}}"}</code> yazan yere
            çıktı alanlarından üretilen JSON tarifi girer — alan eklediğinde
            burayı elle güncellemene gerek yok.
          </Alert>

          <Card className="p-5">
            <CardHead
              title="Sistem mesajı"
              desc="Modelin rolü ve değişmez kuralları. Her istekte başa eklenir."
            />
            <Textarea
              value={sistem}
              onChange={(e) => setSistem(e.target.value)}
              className="min-h-[130px] font-mono text-[13px]"
              placeholder="Sen bir haber analistisin. Yalnızca geçerli JSON döndür..."
            />
          </Card>

          <Card className="p-5">
            <CardHead
              title="Şablon"
              desc="Haberin alanları buraya yerleşir. Kullanılabilir yer tutucular: {{baslik}} {{ozet}} {{govde}} {{kategori}} {{sehir}} {{sema}}"
            />
            <Textarea
              value={sablon}
              onChange={(e) => setSablon(e.target.value)}
              className="min-h-[220px] font-mono text-[13px]"
              placeholder={"BAŞLIK: {{baslik}}\nGÖVDE: {{govde}}\n\nŞu şemada JSON döndür:\n{{sema}}"}
            />
            <div className="mt-4">
              <Field label="Bu sürümün notu" hint="isteğe bağlı">
                <Input
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                  placeholder="Önem puanı fazla cömertti, kalibre edildi"
                />
              </Field>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2.5">
            <Button onClick={() => promptKaydet(true)} loading={kaydediyor} disabled={!kirli}>
              Kaydet ve etkinleştir
            </Button>
            <Button variant="outline" onClick={() => promptKaydet(false)} loading={kaydediyor} disabled={!kirli}>
              Sürüm olarak kaydet
            </Button>
            <Button variant="ghost" onClick={onizlemeAl} loading={onizlemeYukleniyor}>
              <Icon name="eye" size={16} /> Önizle
            </Button>
          </div>

          {/* Önizleme: modele GİDECEK metnin aynısı */}
          {onizleme && (
            <Card className="kb-scale p-5">
              <CardHead
                title="Modele gidecek metin"
                desc={`Örnek haber: ${onizleme.haber}`}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setOnizleme(null)}>
                    Kapat
                  </Button>
                }
              />
              <div className="mb-2 text-[12px] font-semibold text-muted">SİSTEM</div>
              <pre className="kb-scrollbar mb-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-[12px] bg-field p-3 text-[12.5px] leading-relaxed">
                {onizleme.sistem}
              </pre>
              <div className="mb-2 text-[12px] font-semibold text-muted">KULLANICI</div>
              <pre className="kb-scrollbar max-h-80 overflow-auto whitespace-pre-wrap rounded-[12px] bg-field p-3 text-[12.5px] leading-relaxed">
                {onizleme.kullanici}
              </pre>
            </Card>
          )}

          {/* Sürüm geçmişi */}
          <Card className="p-5">
            <CardHead title="Sürümler" desc="Etkin sürüm modele gönderilen sürümdür." />
            {surumler.length === 0 ? (
              <EmptyState title="Henüz sürüm yok" description="Yukarıdan ilk sürümü kaydet." />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Sürüm</Th>
                      <Th>Not</Th>
                      <Th>Ekleyen</Th>
                      <Th align="end">Kullanım</Th>
                      <Th align="end" />
                    </tr>
                  </thead>
                  <tbody>
                    {surumler.map((p) => (
                      <tr key={p.id}>
                        <Td>
                          <span className="kb-num font-semibold">v{p.versiyon}</span>
                          {p.is_active && <Badge tone="accent" className="ms-2">Etkin</Badge>}
                        </Td>
                        <Td className="text-muted">{p.aciklama ?? "—"}</Td>
                        <Td className="text-muted">{p.created_by_name}</Td>
                        <Td align="end" className="kb-num text-muted">{p.kullanim_sayisi}</Td>
                        <Td align="end">
                          {!p.is_active && (
                            <Button variant="outline" size="sm" onClick={() => surumEtkinlestir(p.id)}>
                              Bu sürüme dön
                            </Button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>
      )}

      {/* ══════════════ ÇIKTI ALANLARI ══════════════ */}
      {bolum === "sema" && (
        <div className="kb-stagger flex flex-col gap-5">
          <Alert tone="muted">
            Çekirdek dört alan (özet, önem puanı, çocuk güvenliği, Instagram)
            her zaman şemada — site onları doğrudan okuyor. Buradan{" "}
            <strong>ek alan</strong> tanımlıyorsun. Her açık alan modelin daha
            çok token üretmesi demek; gereksizleri kapalı tut.
          </Alert>

          <Card className="p-5">
            <CardHead
              title="Tanımlı alanlar"
              action={
                <Button size="sm" onClick={() => setDuzenlenen({ ...BOS_ALAN })}>
                  <Icon name="plus" size={16} /> Alan ekle
                </Button>
              }
            />
            {alanlar.length === 0 ? (
              <EmptyState title="Ek alan yok" description="Model yalnızca çekirdek alanları döndürür." />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Anahtar</Th>
                      <Th>Etiket</Th>
                      <Th>Tip</Th>
                      <Th align="end">Dolu haber</Th>
                      <Th align="center">Açık</Th>
                      <Th align="end" />
                    </tr>
                  </thead>
                  <tbody>
                    {alanlar.map((f) => (
                      <tr key={f.id}>
                        <Td><code className="rounded bg-chip px-1.5 py-0.5 text-[12.5px]">{f.anahtar}</code></Td>
                        <Td>{f.etiket}</Td>
                        <Td className="text-muted">{TIPLER.find((t) => t.v === f.tip)?.l ?? f.tip}</Td>
                        <Td align="end" className="kb-num text-muted">{f.dolu_haber}</Td>
                        <Td align="center">
                          <div className="flex justify-center">
                            <Switch checked={f.is_active} onChange={(v) => alanAcKapa(f, v)} label={f.etiket} />
                          </div>
                        </Td>
                        <Td align="end">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => setDuzenlenen({
                              id: f.id, anahtar: f.anahtar, etiket: f.etiket, tip: f.tip,
                              aciklama: f.aciklama, min_deger: f.min_deger, max_deger: f.max_deger,
                              max_oge: f.max_oge, zorunlu: f.zorunlu, is_active: f.is_active,
                              sort_order: f.sort_order,
                            })}>
                              Düzenle
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSilinecek(f)}>
                              <Icon name="trash" size={15} />
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          {/* Alan formu */}
          {duzenlenen && (
            <Card className="kb-scale p-5">
              <CardHead
                title={duzenlenen.id ? "Alanı düzenle" : "Yeni alan"}
                desc={duzenlenen.id
                  ? "Anahtar değiştirilemez — toplanmış veriler o adla saklanıyor."
                  : "Anahtar JSON'da kullanılacak ad. Sonradan değiştirilemez."}
                action={<Button variant="ghost" size="sm" onClick={() => setDuzenlenen(null)}>Vazgeç</Button>}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Anahtar" hint="küçük harf, alt çizgi">
                  <Input
                    value={duzenlenen.anahtar}
                    disabled={Boolean(duzenlenen.id)}
                    onChange={(e) => setDuzenlenen({ ...duzenlenen, anahtar: e.target.value })}
                    placeholder="etiketler"
                    className="font-mono"
                  />
                </Field>
                <Field label="Etiket" hint="panelde görünen ad">
                  <Input
                    value={duzenlenen.etiket}
                    onChange={(e) => setDuzenlenen({ ...duzenlenen, etiket: e.target.value })}
                    placeholder="SEO etiketleri"
                  />
                </Field>
                <Field label="Tip">
                  <Select
                    value={duzenlenen.tip}
                    onChange={(e) => setDuzenlenen({ ...duzenlenen, tip: e.target.value })}
                  >
                    {TIPLER.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </Select>
                </Field>
                <Field label="Sıra">
                  <Input
                    type="number"
                    value={duzenlenen.sort_order}
                    onChange={(e) => setDuzenlenen({ ...duzenlenen, sort_order: Number(e.target.value) })}
                  />
                </Field>

                {duzenlenen.tip === "sayi" && (
                  <>
                    <Field label="En küçük değer">
                      <Input type="number" value={duzenlenen.min_deger ?? ""}
                        onChange={(e) => setDuzenlenen({ ...duzenlenen, min_deger: e.target.value === "" ? null : Number(e.target.value) })} />
                    </Field>
                    <Field label="En büyük değer">
                      <Input type="number" value={duzenlenen.max_deger ?? ""}
                        onChange={(e) => setDuzenlenen({ ...duzenlenen, max_deger: e.target.value === "" ? null : Number(e.target.value) })} />
                    </Field>
                  </>
                )}
                {duzenlenen.tip === "liste" && (
                  <Field label="En fazla öğe" hint="model fazlasını döndürürse kesilir">
                    <Input type="number" value={duzenlenen.max_oge}
                      onChange={(e) => setDuzenlenen({ ...duzenlenen, max_oge: Number(e.target.value) })} />
                  </Field>
                )}
              </div>

              <div className="mt-4">
                <Field
                  label="Modele açıklama"
                  hint="alanın kalitesi neredeyse tamamen buna bağlı"
                >
                  <Textarea
                    value={duzenlenen.aciklama}
                    onChange={(e) => setDuzenlenen({ ...duzenlenen, aciklama: e.target.value })}
                    className="min-h-[80px]"
                    placeholder="Haberle ilgili 3-6 arama etiketi. Tek kelime ya da kısa öbek, küçük harf."
                  />
                </Field>
              </div>

              <Divider className="my-4" />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2.5 text-[13.5px]">
                  <Switch
                    checked={duzenlenen.zorunlu}
                    onChange={(v) => setDuzenlenen({ ...duzenlenen, zorunlu: v })}
                    label="Zorunlu"
                  />
                  <span>Model bu alanı boş bırakamasın</span>
                </label>
                <div className="ms-auto flex gap-2">
                  <Button variant="ghost" onClick={() => setDuzenlenen(null)}>Vazgeç</Button>
                  <Button onClick={alanKaydet}>Kaydet</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Üretilen şema — modele gidecek olan */}
          <Card className="p-5">
            <CardHead
              title="Üretilen şema"
              desc="Promptta {{sema}} yazan yere bu metin girer."
            />
            <pre className="kb-scrollbar max-h-72 overflow-auto whitespace-pre-wrap rounded-[12px] bg-field p-3.5 text-[12.5px] leading-relaxed">
              {sema || "{}"}
            </pre>
          </Card>
        </div>
      )}

      <SaveBar
        dirty={kirli && bolum !== "sema"}
        saving={kaydediyor}
        onSave={() => promptKaydet(true)}
        onReset={() => { setSistem(ilkHal.sistem); setSablon(ilkHal.sablon); }}
        note="Prompt değişti — kaydedince yeni sürüm açılır."
      />

      <ConfirmDialog
        open={Boolean(silinecek)}
        onClose={() => { setSilinecek(null); setVeriyiSil(false); }}
        title={`"${silinecek?.etiket}" alanı silinsin mi?`}
        description={
          silinecek && silinecek.dolu_haber > 0
            ? `${silinecek.dolu_haber} haberde bu alanın verisi var. Varsayılan olarak veriler KORUNUR; alanı yeniden tanımlarsan geri gelir.`
            : "Alan tanımı silinecek."
        }
        confirmLabel="Sil"
        onConfirm={alanSil}
      />
    </div>
  );
}
