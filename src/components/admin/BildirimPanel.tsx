"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Card, CardHead, Divider } from "@/components/ui";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Anahtar } from "@/components/ui/Anahtar";
import Icon from "@/components/ui/Icon";

/* ══════════════════════════════════════════════════════════════
   BİLDİRİM YÖNETİMİ

   Dört bölüm: özet, ayarlar, gönderim, geçmiş.

   ⚠ AYARLAR VE GÖNDERİM AYRI.
   Ayarlar kalıcı kurallar (günlük sınır, sessiz saat);
   gönderim tek seferlik. Tek formda birleştirmek "kaydet"
   düğmesinin neyi kaydettiğini belirsizleştiriyordu.
   ══════════════════════════════════════════════════════════════ */

interface Ozet {
  bugun_toplam: number;
  bugun_otomatik: number;
  bugun_ulasan: number;
  bekleyen: number;
  cihaz_toplam: number;
  cihaz_acik: number;
  cihaz_ios: number;
  cihaz_android: number;
}

interface Bildirim {
  id: string;
  baslik: string;
  govde: string;
  tur: string;
  durum: string;
  sehir: string | null;
  hedef_adet: number;
  basarili: number;
  basarisiz: number;
  gonderildi: string | null;
  created_at: string;
}

interface Ayarlar {
  push_acik: boolean;
  push_gunluk_sinir: number;
  push_son_dakika: boolean;
  push_sehir_haberi: boolean;
  push_sessiz_baslangic: number;
  push_sessiz_bitis: number;
}

const DURUM: Record<string, { ad: string; renk: string }> = {
  bekliyor:     { ad: "Bekliyor",     renk: "text-amber-500" },
  gonderiliyor: { ad: "Gönderiliyor", renk: "text-sky-500" },
  tamam:        { ad: "Gönderildi",   renk: "text-emerald-500" },
  hata:         { ad: "Hata",         renk: "text-red-500" },
  iptal:        { ad: "İptal",        renk: "text-muted2" },
};

const TUR: Record<string, string> = {
  manuel: "Elle", son_dakika: "Son dakika",
  sehir: "Şehir", otomatik: "Otomatik",
};

export default function BildirimPanel() {
  const sb = supabaseBrowser();
  const t = useToast();

  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [liste, setListe] = useState<Bildirim[]>([]);
  const [ayar, setAyar] = useState<Ayarlar | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [gonderAcik, setGonderAcik] = useState(false);
  const [testAcik, setTestAcik] = useState(false);
  const [silinecek, setSilinecek] = useState<Bildirim | null>(null);

  const yukle = useCallback(async () => {
    const [o, l, a] = await Promise.all([
      sb.rpc("admin_bildirim_ozet"),
      sb.rpc("admin_bildirim_liste", { p_limit: 50 }),
      sb.from("public_site_settings")
        .select("push_acik, push_gunluk_sinir, push_son_dakika, "
          + "push_sehir_haberi, push_sessiz_baslangic, push_sessiz_bitis")
        .maybeSingle(),
    ]);

    setYukleniyor(false);

    if (o.data) setOzet(o.data as unknown as Ozet);
    if (l.data) setListe(l.data as unknown as Bildirim[]);
    if (a.data) setAyar(a.data as unknown as Ayarlar);

    if (o.error) t.error("Özet okunamadı: " + o.error.message);
  }, [sb, t]);

  useEffect(() => { void yukle(); }, [yukle]);

  /*
   * ⚠ İYİMSER GÜNCELLEME.
   * Anahtar sunucu yanıtını beklerse tıklamaya tepki
   * vermemiş gibi görünüyor. Hata olursa geri alınıyor.
   */
  const ayarDegis = useCallback(async (
    alan: keyof Ayarlar, deger: boolean | number,
  ) => {
    if (!ayar) return;
    const eski = ayar[alan];
    setAyar({ ...ayar, [alan]: deger } as Ayarlar);

    const { error } = await sb.rpc("admin_update_settings", {
      p_patch: { [alan]: deger },
    });

    if (error) {
      setAyar({ ...ayar, [alan]: eski } as Ayarlar);
      t.error(error.message);
    }
  }, [ayar, sb, t]);

  async function sil() {
    if (!silinecek) return;
    const { data, error } = await sb.rpc("admin_bildirim_sil", {
      p_id: silinecek.id,
    });
    setSilinecek(null);

    if (error) { t.error(error.message); return; }
    if (data === false) {
      /*
       * ⚠ GÖNDERİLMİŞ BİLDİRİM SİLİNMİYOR.
       * "Bugün kaç push attık" sorusunun cevabı bu kayıtlarda.
       * Sunucu reddediyor; kullanıcıya sebebi söyleniyor.
       */
      t.error("Gönderilmiş bildirim kaydı silinemez");
      return;
    }
    t.success("İptal edildi");
    await yukle();
  }

  return (
    <div className="grid gap-5">
      {/* ---- özet ---- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <OzetKart
          etiket="Bugün gönderilen" deger={ozet?.bugun_toplam}
          alt={`${ozet?.bugun_otomatik ?? 0} otomatik`}
          yukleniyor={yukleniyor}
        />
        <OzetKart
          etiket="Ulaşan cihaz" deger={ozet?.bugun_ulasan}
          alt="bugün" yukleniyor={yukleniyor}
        />
        <OzetKart
          etiket="Kayıtlı cihaz" deger={ozet?.cihaz_toplam}
          alt={`${ozet?.cihaz_acik ?? 0} bildirime açık`}
          yukleniyor={yukleniyor}
        />
        <OzetKart
          etiket="Platform"
          metin={`${ozet?.cihaz_ios ?? 0} iOS · ${ozet?.cihaz_android ?? 0} Android`}
          yukleniyor={yukleniyor}
        />
      </div>

      {/* ---- ayarlar ---- */}
      <Card className="p-5">
        <CardHead
          title="Bildirim ayarları"
          desc="Bu kurallar otomatik bildirimlere uygulanır. Elle gönderim sınır ve sessiz saat dışındadır."
        />

        {ayar && (
          <div className="grid gap-3">
            <SatirAnahtar
              ad="Bildirimler açık"
              aciklama="Kapalıyken hiçbir bildirim gönderilmez — test dahil."
              deger={ayar.push_acik}
              onDegis={(v) => void ayarDegis("push_acik", v)}
            />

            <Divider />

            <SatirAnahtar
              ad="Son dakika bildirimleri"
              aciklama="Haber son dakika işaretlenince otomatik gönderilir."
              deger={ayar.push_son_dakika}
              onDegis={(v) => void ayarDegis("push_son_dakika", v)}
            />

            <SatirAnahtar
              ad="Şehir haberi bildirimleri"
              aciklama="Okurun seçtiği şehirde haber çıkınca gönderilir."
              deger={ayar.push_sehir_haberi}
              onDegis={(v) => void ayarDegis("push_sehir_haberi", v)}
            />

            <Divider />

            <div className="flex flex-wrap items-center justify-between gap-3 py-1">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">Günlük sınır</div>
                <p className="mt-0.5 text-[12px] text-muted2">
                  Günde en fazla kaç otomatik bildirim gönderilsin.
                </p>
              </div>
              <input
                type="number"
                min={0}
                max={50}
                value={ayar.push_gunluk_sinir}
                onChange={(e) =>
                  void ayarDegis("push_gunluk_sinir", Number(e.target.value))}
                className="w-20 rounded-lg border border-line bg-transparent px-3 py-2 text-center text-[14px]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 py-1">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">Sessiz saatler</div>
                <p className="mt-0.5 text-[12px] text-muted2">
                  Bu aralıkta otomatik bildirim gönderilmez.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SaatSecici
                  deger={ayar.push_sessiz_baslangic}
                  onDegis={(v) => void ayarDegis("push_sessiz_baslangic", v)}
                />
                <span className="text-[13px] text-muted2">—</span>
                <SaatSecici
                  deger={ayar.push_sessiz_bitis}
                  onDegis={(v) => void ayarDegis("push_sessiz_bitis", v)}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ---- gönderim ---- */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardHead
            title="Bildirim gönder"
            desc="Elle gönderilen bildirimler günlük sınıra ve sessiz saatlere takılmaz."
          />

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setTestAcik(true)}
              className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold"
            >
              Test gönder
            </button>
            <button
              type="button"
              onClick={() => setGonderAcik(true)}
              disabled={!ayar?.push_acik}
              title={ayar?.push_acik ? undefined : "Bildirimler kapalı"}
              className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-[13px] font-bold text-bg disabled:opacity-40"
            >
              <Icon name="plus" size={15} /> Yeni bildirim
            </button>
          </div>
        </div>
      </Card>

      {/* ---- geçmiş ---- */}
      <Card className="p-5">
        <CardHead title="Geçmiş" desc="Son 50 bildirim." />

        {yukleniyor ? (
          <div className="grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface2" />
            ))}
          </div>
        ) : liste.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-muted2">
            Henüz bildirim gönderilmedi.
          </p>
        ) : (
          <div className="grid gap-2">
            {liste.map((b) => {
              const d = DURUM[b.durum] ?? { ad: b.durum, renk: "text-muted2" };
              return (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-bold">{b.baslik}</span>
                      <span className="rounded-md bg-chip px-1.5 py-0.5 text-[10.5px] font-bold text-muted2">
                        {TUR[b.tur] ?? b.tur}
                      </span>
                      {b.sehir && (
                        <span className="text-[11.5px] text-muted2">
                          {b.sehir}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted2">
                      {b.govde}
                    </p>
                  </div>

                  <div className="shrink-0 text-end">
                    <div className={`text-[12px] font-bold ${d.renk}`}>
                      {d.ad}
                    </div>
                    <div className="text-[11.5px] text-muted2">
                      {b.durum === "tamam"
                        ? `${b.basarili.toLocaleString("tr-TR")} / ${b.hedef_adet.toLocaleString("tr-TR")}`
                        : `${b.hedef_adet.toLocaleString("tr-TR")} hedef`}
                    </div>
                  </div>

                  {b.durum === "bekliyor" && (
                    <button
                      type="button"
                      onClick={() => setSilinecek(b)}
                      aria-label="İptal et"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/40 text-red-500"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {gonderAcik && (
        <GonderPenceresi
          onKapat={() => setGonderAcik(false)}
          onGonderildi={async () => { setGonderAcik(false); await yukle(); }}
        />
      )}

      {testAcik && (
        <TestPenceresi onKapat={() => setTestAcik(false)} />
      )}

      <ConfirmDialog
        open={Boolean(silinecek)}
        title="Bildirim iptal edilsin mi?"
        description="Bekleyen bildirim kuyruktan çıkarılır ve gönderilmez."
        confirmLabel="İptal et"
        onConfirm={() => void sil()}
        onClose={() => setSilinecek(null)}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   YAPI TAŞLARI
   ══════════════════════════════════════════════════════════════ */

function OzetKart({
  etiket, deger, alt, metin, yukleniyor,
}: {
  etiket: string;
  deger?: number;
  alt?: string;
  metin?: string;
  yukleniyor: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="text-[11.5px] font-bold text-muted2">
        {etiket.toLocaleUpperCase("tr")}
      </div>

      {yukleniyor ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-surface2" />
      ) : metin ? (
        <div className="mt-1.5 text-[14px] font-bold">{metin}</div>
      ) : (
        <div className="mt-1 text-[26px] font-extrabold leading-none">
          {(deger ?? 0).toLocaleString("tr-TR")}
        </div>
      )}

      {alt && !yukleniyor && (
        <div className="mt-1.5 text-[11.5px] text-muted2">{alt}</div>
      )}
    </div>
  );
}

function SatirAnahtar({
  ad, aciklama, deger, onDegis,
}: {
  ad: string; aciklama: string;
  deger: boolean; onDegis: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{ad}</div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted2">
          {aciklama}
        </p>
      </div>
      <Anahtar acik={deger} onDegis={onDegis} />
    </div>
  );
}

function SaatSecici({
  deger, onDegis,
}: { deger: number; onDegis: (v: number) => void }) {
  return (
    <select
      value={deger}
      onChange={(e) => onDegis(Number(e.target.value))}
      className="rounded-lg border border-line bg-transparent px-2.5 py-2 text-[13px]"
    >
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={i}>
          {String(i).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}

/* ══════════════════════════════════════════════════════════════
   GÖNDERİM PENCERESİ
   ══════════════════════════════════════════════════════════════ */

function GonderPenceresi({
  onKapat, onGonderildi,
}: { onKapat: () => void; onGonderildi: () => void }) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [baslik, setBaslik] = useState("");
  const [govde, setGovde] = useState("");
  const [kitle, setKitle] = useState("herkes");
  const [sehir, setSehir] = useState("");
  const [sehirler, setSehirler] = useState<{ slug: string; ad: string }[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await sb.from("cities").select("slug, name").order("name");
      setSehirler(((r.data ?? []) as unknown as Record<string, unknown>[])
        .map((x) => ({ slug: String(x.slug), ad: String(x.name) })));
    })();
  }, [sb]);

  const gecerli = baslik.trim().length > 0
    && govde.trim().length > 0
    && (kitle !== "sehir" || sehir !== "");

  async function gonder() {
    if (!gecerli || gonderiliyor) return;
    setGonderiliyor(true);

    const { error } = await sb.rpc("admin_bildirim_ekle", {
      p: {
        baslik: baslik.trim(),
        govde: govde.trim(),
        tur: "manuel",
        hedef_kitle: kitle,
        sehir: kitle === "sehir" ? sehir : null,
      },
    });
    setGonderiliyor(false);

    if (error) { t.error(error.message); return; }
    t.success("Bildirim kuyruğa alındı");
    onGonderildi();
  }

  return (
    <Modal open onClose={onKapat} title="Bildirim gönder">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold">
            Başlık
          </label>
          <input
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            maxLength={60}
            placeholder="Son dakika"
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold">
            Metin
          </label>
          <textarea
            value={govde}
            onChange={(e) => setGovde(e.target.value)}
            rows={3}
            maxLength={180}
            placeholder="Bildirimde görünecek metin"
            className="w-full resize-y rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
          />
          {/*
            ⚠ UZUNLUK UYARISI.
            iOS bildirimde ~110 karakterden fazlasını kesiyor.
            Yazarken görünmesi, gönderdikten sonra fark
            etmekten iyi.
          */}
          <p className="mt-1 text-[11.5px] text-muted2">
            {govde.length}/180
            {govde.length > 110 && " — uzun metinler telefonda kısaltılır"}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold">
            Kime
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { k: "herkes", ad: "Herkese" },
              { k: "sehir", ad: "Bir şehre" },
              { k: "uyeler", ad: "Üyelere" },
              { k: "misafirler", ad: "Misafirlere" },
            ] as const).map((x) => (
              <button
                key={x.k}
                type="button"
                onClick={() => setKitle(x.k)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
                  kitle === x.k
                    ? "bg-solid text-on-solid"
                    : "bg-chip text-ink2"
                }`}
              >
                {x.ad}
              </button>
            ))}
          </div>
        </div>

        {kitle === "sehir" && (
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold">
              Şehir
            </label>
            <select
              value={sehir}
              onChange={(e) => setSehir(e.target.value)}
              className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
            >
              <option value="">Seç…</option>
              {sehirler.map((s) => (
                <option key={s.slug} value={s.slug}>{s.ad}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onKapat}
            className="rounded-lg border border-line px-4 py-2.5 text-[13px] font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void gonder()}
            disabled={!gecerli || gonderiliyor}
            className="rounded-lg bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-40"
          >
            {gonderiliyor ? "Gönderiliyor…" : "Kuyruğa al"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEST PENCERESİ

   ⚠ TEST SAYAÇLARA GİRMİYOR.
   Sunucu `test_mi` işaretiyle kaydediyor; günlük sınırı
   tüketmiyor ve "bugün kaç push" sayısına eklenmiyor.
   ══════════════════════════════════════════════════════════════ */

function TestPenceresi({ onKapat }: { onKapat: () => void }) {
  const sb = supabaseBrowser();
  const t = useToast();

  const [jeton, setJeton] = useState("");
  const [baslik, setBaslik] = useState("Test bildirimi");
  const [govde, setGovde] = useState("Bu bir deneme bildirimidir.");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder() {
    if (!jeton.trim() || gonderiliyor) return;
    setGonderiliyor(true);

    const { error } = await sb.rpc("admin_bildirim_test", {
      p_token: jeton.trim(),
      p_baslik: baslik.trim(),
      p_govde: govde.trim(),
    });
    setGonderiliyor(false);

    if (error) { t.error(error.message); return; }
    t.success("Test kuyruğa alındı");
    onKapat();
  }

  return (
    <Modal open onClose={onKapat} title="Test bildirimi">
      <div className="grid gap-4">
        <p className="text-[12.5px] leading-relaxed text-muted2">
          Tek bir cihaza deneme gönderir. Günlük sınıra ve
          sayaçlara dahil edilmez.
        </p>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold">
            Expo jetonu
          </label>
          <input
            value={jeton}
            onChange={(e) => setJeton(e.target.value)}
            placeholder="ExponentPushToken[...]"
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 font-mono text-[12.5px]"
          />
          <p className="mt-1 text-[11.5px] text-muted2">
            Kendi telefonundaki jetonu uygulamanın geliştirici
            günlüğünde görebilirsin.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold">
            Başlık
          </label>
          <input
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold">
            Metin
          </label>
          <input
            value={govde}
            onChange={(e) => setGovde(e.target.value)}
            className="w-full rounded-lg border border-line bg-transparent px-3 py-2.5 text-[14px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onKapat}
            className="rounded-lg border border-line px-4 py-2.5 text-[13px] font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void gonder()}
            disabled={!jeton.trim() || gonderiliyor}
            className="rounded-lg bg-ink px-5 py-2.5 text-[13px] font-bold text-bg disabled:opacity-40"
          >
            {gonderiliyor ? "Gönderiliyor…" : "Gönder"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
