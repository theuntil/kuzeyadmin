"use client";
import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Field, Input, Alert, H2 } from "@/components/ui";

/**
 * PANEL GİRİŞİ
 *
 * Kayıt yolu YOK: panele yalnızca sitede hesabı olan ve rolü
 * yükseltilmiş kişiler girer.
 *
 * Hata mesajı bilgi sızdırmaz: "kullanıcı yok" ile "şifre yanlış"
 * ayrımı yapılmaz.
 */
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(), password,
    });

    if (error) {
      setErr(/supabase ayarları|not configured/i.test(error.message)
        ? "Sunucu yapılandırması eksik: SUPABASE_URL ve SUPABASE_ANON_KEY."
        : "E-posta veya şifre hatalı.");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-page px-5">
      <div className="ct-rise w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <H2>Kuzeybatı Haber</H2>
          <p className="mt-2 text-[14px] text-muted">Yönetim paneli</p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="E-posta" htmlFor="e">
            <Input
              id="e" type="email" value={email} required
              autoComplete="username" inputMode="email"
              onChange={(ev) => setEmail(ev.target.value)}
            />
          </Field>

          <Field label="Şifre" htmlFor="p">
            <Input
              id="p" type="password" value={password} required
              autoComplete="current-password"
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </Field>

          {err && <Alert tone="danger">{err}</Alert>}

          <Button type="submit" variant="accent" size="lg" loading={busy} className="mt-1 w-full">
            Giriş yap
          </Button>
        </form>
      </div>
    </div>
  );
}
