"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { useApp } from "./app-provider";
import { Button, Field, Input } from "./ui";
import { Logo } from "./logo";

type Mode = "login" | "register" | "reset";

function authMessage(msg: string, t: (s: string) => string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return t("E-posta veya şifre hatalı.");
  if (m.includes("already registered") || m.includes("already been registered")) return t("Bu e-posta ile zaten bir hesap var.");
  if (m.includes("email not confirmed")) return t("E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzu kontrol edin.");
  if (m.includes("password")) return t("Şifre en az 8 karakter olmalı.");
  if (m.includes("rate limit") || m.includes("too many")) return t("Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.");
  if (m.includes("fetch") || m.includes("network")) return t("Bağlantı kurulamadı. İnternetinizi kontrol edin.");
  return t("İşlem tamamlanamadı. Lütfen tekrar deneyin.");
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { t, lang, setLang, session, ready } = useApp();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && session && mode !== "reset") router.replace("/");
  }, [ready, session, mode, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!supabaseConfigured) return setError(t("Sunucu yapılandırılmamış."));
    if (mode !== "reset" || recovery) {
      if (password.length < 8) return setError(t("Şifre en az 8 karakter olmalı."));
    }
    if (mode === "register" && !consent) return setError(t("Devam etmek için aydınlatma metnini onaylamalısınız."));
    setBusy(true);
    try {
      const sb = supabase();
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/");
      } else if (mode === "register") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), language: lang }, emailRedirectTo: `${location.origin}/` },
        });
        if (error) throw error;
        if (data.session) router.replace("/onboarding");
        else setInfo(t("Hesabınız oluşturuldu. E-postanıza gönderilen bağlantıya tıklayarak hesabınızı doğrulayın."));
      } else if (recovery) {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/");
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/reset` });
        if (error) throw error;
        setInfo(t("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."));
      }
    } catch (err) {
      setError(authMessage((err as Error).message ?? "", t));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? t("Giriş yap") : mode === "register" ? t("Hesap oluştur") : recovery ? t("Yeni şifre belirle") : t("Şifremi unuttum");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-8">
      <div className="mb-8 text-center">
        <Logo size={64} className="mx-auto mb-3" />
        <p className="text-2xl font-bold tracking-tight">BKNY</p>
        <p className="mt-1 text-sm font-medium text-primary">{t("Bugün kendin için ne yaptın?")}</p>
        <p className="mt-1 text-xs text-muted">{t("Yapay zekâ destekli beslenme ve yaşam takibi")}</p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface p-5" noValidate>
        <h1 className="text-lg font-semibold">{title}</h1>
        {mode === "register" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Ad")}>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required maxLength={80} />
            </Field>
            <Field label={t("Soyad")}>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required maxLength={80} />
            </Field>
          </div>
        )}
        {!(mode === "reset" && recovery) && (
          <Field label={t("E-posta")}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required inputMode="email" />
          </Field>
        )}
        {(mode !== "reset" || recovery) && (
          <Field label={mode === "reset" ? t("Yeni şifre") : t("Şifre")} hint={mode !== "login" ? t("En az 8 karakter") : undefined}>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} />
          </Field>
        )}
        {mode === "register" && (
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
            <span>
              <Link href="/privacy" className="font-medium text-primary underline" target="_blank">
                {t("Gizlilik ve KVKK aydınlatma metnini")}
              </Link>{" "}
              {t("okudum; sağlık verilerimin bu uygulamada işlenmesine açık rıza veriyorum.")}
            </span>
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {info && <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">{info}</p>}
        <Button type="submit" loading={busy} className="w-full" size="lg">
          {mode === "login" ? t("Giriş yap") : mode === "register" ? t("Kayıt ol") : recovery ? t("Şifreyi kaydet") : t("Bağlantı gönder")}
        </Button>
        {mode === "login" && (
          <Link href="/reset" className="block text-center text-sm text-muted underline">
            {t("Şifremi unuttum")}
          </Link>
        )}
      </form>
      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/" className="underline">
          {t("BKNY nedir?")}
        </Link>
      </p>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? t("Hesabınız yok mu?") : t("Zaten hesabınız var mı?")}{" "}
        <Link href={mode === "login" ? "/register" : "/login"} className="font-semibold text-primary">
          {mode === "login" ? t("Kayıt ol") : t("Giriş yap")}
        </Link>
      </p>
      <button type="button" onClick={() => setLang(lang === "tr" ? "en" : "tr")} className="mx-auto mt-6 text-xs text-muted underline">
        {lang === "tr" ? "English" : "Türkçe"}
      </button>
    </main>
  );
}
