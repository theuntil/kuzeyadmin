"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Button, Field, Input, Divider } from "@/components/ui";

/* ══════════════════════════════════════════════════════════════
   SOSYAL BAĞLANTILAR

   ┌─ TAM ADRES DEĞİL, KULLANICI ADI ⚠️ ───────────────────────┐
   │ Veritabanında yalnızca kullanıcı adı saklanıyor            │
   │ ("kuzeybatihaber"). Adres site tarafında kuruluyor.        │
   │                                                              │
   │ Kullanıcı ne yapıştırırsa yapıştırsın — "@kuzeybati",      │
   │ "https://instagram.com/kuzeybati/", "instagram.com/..." —   │
   │ sunucu temizliyor. Onu doğru biçime zorlamak yerine         │
   │ yapıştırdığını kabul etmek daha kolay.                      │
   └──────────────────────────────────────────────────────────────┘

   Web sitesi de "https://" olmadan saklanıyor; adres tek biçimde
   kalıyor ve karşılaştırılabiliyor.
   ══════════════════════════════════════════════════════════════ */

export interface Sosyal {
  instagram?: string | null;
  facebook?: string | null;
  x?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  website?: string | null;
}

const ALANLAR: { anahtar: keyof Sosyal; etiket: string; ipucu: string }[] = [
  { anahtar: "website",   etiket: "Web sitesi", ipucu: "https:// yazmana gerek yok" },
  { anahtar: "instagram", etiket: "Instagram",  ipucu: "kullanıcı adı ya da bağlantı" },
  { anahtar: "x",         etiket: "X",          ipucu: "eski adıyla Twitter" },
  { anahtar: "facebook",  etiket: "Facebook",   ipucu: "sayfa adı" },
  { anahtar: "youtube",   etiket: "YouTube",    ipucu: "kanal adı" },
  { anahtar: "linkedin",  etiket: "LinkedIn",   ipucu: "profil adı" },
  { anahtar: "tiktok",    etiket: "TikTok",     ipucu: "kullanıcı adı" },
];

/** Kaydedilmiş değerin nereye gittiğini göster */
const ONIZLE: Record<string, (k: string) => string> = {
  website:   (k) => `https://${k}`,
  instagram: (k) => `instagram.com/${k}`,
  x:         (k) => `x.com/${k}`,
  facebook:  (k) => `facebook.com/${k}`,
  youtube:   (k) => `youtube.com/@${k}`,
  linkedin:  (k) => `linkedin.com/in/${k}`,
  tiktok:    (k) => `tiktok.com/@${k}`,
};

export default function SosyalDuzenle({
  tur, id, mevcut, onKaydedildi, onDegisti, ayriKaydet = true,
}: {
  tur: "kullanici" | "kaynak";
  id: string;
  mevcut: Sosyal | null;
  onKaydedildi?: (yeni: Sosyal) => void;
  /** Üst form kendi kaydediyorsa değişiklikler buradan gidiyor */
  onDegisti?: (yeni: Sosyal) => void;
  /** false ise kendi kaydet düğmesi çizilmiyor */
  ayriKaydet?: boolean;
}) {
  const sb = supabaseBrowser();
  const t = useToast();
  const [form, setForm] = useState<Sosyal>(mevcut ?? {});
  const [kaydediyor, setKaydediyor] = useState(false);

  async function kaydet() {
    setKaydediyor(true);
    const { error } = await sb.rpc("admin_sosyal_guncelle", {
      p: { tur, id, links: form },
    });
    setKaydediyor(false);
    if (error) { t.error(error.message); return; }
    t.success("Bağlantılar kaydedildi");
    onKaydedildi?.(form);
  }

  return (
    <div>
      <div className="kb-eyebrow mb-3">Bağlantılar</div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ALANLAR.map((a) => {
          const deger = (form[a.anahtar] ?? "") as string;
          return (
            <Field
              key={a.anahtar}
              label={a.etiket}
              hint={
                deger.trim()
                  ? ONIZLE[a.anahtar]!(deger.trim().replace(/^@/, ""))
                  : a.ipucu
              }
            >
              <Input
                value={deger}
                onChange={(e) => {
                  const y = { ...form, [a.anahtar]: e.target.value };
                  setForm(y);
                  onDegisti?.(y);
                }}
                placeholder={a.anahtar === "website" ? "kuzeybatihaber.com.tr" : "kullaniciadi"}
              />
            </Field>
          );
        })}
      </div>

      {/*
        ⚠ AYRI KAYDET DÜĞMESİ YOK.
        Formda zaten bir "Kaydet" var; ikincisi hangisinin neyi
        kaydettiği konusunda kafa karıştırıyordu. Değişiklikler
        üst bileşene bildiriliyor, tek düğmeyle gidiyor.
      */}
      {ayriKaydet && (
        <>
          <Divider className="my-4" />
          <Button onClick={kaydet} loading={kaydediyor}>Bağlantıları kaydet</Button>
        </>
      )}
    </div>
  );
}
