"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Crown, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, PageHeader } from "@/components/ui";
import { Celebration } from "@/components/celebration";
import { AndroidIcon, AppleIcon } from "@/components/platform-icons";
import { buy, billingAvailable, billingDiagnostics, loadPlans, manageUrl, restore, type PlanOption } from "@/lib/billing";
import { isNative } from "@/lib/native";

export default function PremiumPage() {
  const { t, toast, config, refreshConfig, session } = useApp();
  const userId = session?.user.id ?? null;
  const [native, setNative] = useState(false);
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [step, setStep] = useState("başlıyor");
  const [diag, setDiag] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [secs, setSecs] = useState(0);
  const t0 = useRef(0);
  const [busy, setBusy] = useState<string | null>(null);
  const premium = !!config?.premium;

  useEffect(() => {
    setNative(isNative());
    setDiag(billingDiagnostics());
    if (!userId) return;
    if (!billingAvailable()) {
      setLoadError("billing_unavailable: " + billingDiagnostics());
      setPlans([]);
      return;
    }
    setLoadError(null);
    setPlans(null);
    setStep("başlıyor");
    t0.current = Date.now();
    setSecs(0);
    const note = (m: string) => setLog((l) => [...l.slice(-7), `${((Date.now() - t0.current) / 1000).toFixed(1)}s ${m}`]);
    setLog([]);
    note("başladı");
    const onErr = (e: ErrorEvent) => note(`js hata: ${e.message}`.slice(0, 120));
    const onRej = (e: PromiseRejectionEvent) => note(`söz reddi: ${String((e.reason as { message?: string })?.message ?? e.reason)}`.slice(0, 120));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    loadPlans(userId, (s) => {
      setStep(s);
      note(s);
    })
      .then((r) => {
        note("planlar geldi");
        setPlans(r);
      })
      .catch((e: unknown) => {
        note("hata");
        setLoadError(e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "unknown");
        setPlans([]);
      });
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, [userId, attempt]);

  // Sayfanın canlı olduğunu göstermek için saniye sayacı (yükleme sürerken).
  useEffect(() => {
    if (plans !== null) return;
    const id = setInterval(() => setSecs(Math.round((Date.now() - t0.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [plans]);

  /** Webhook birkaç saniye içinde aboneliği yazar; durumu kısa aralıklarla yeniden okur. */
  async function waitForPremium() {
    for (let i = 0; i < 6; i++) {
      await refreshConfig();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function purchase(id: string) {
    if (!userId) return;
    setBusy(id);
    const r = await buy(userId, id);
    if (r === "ok") {
      setCelebrate(true);
      await waitForPremium();
    } else if (r === "failed") toast(t("Satın alma tamamlanamadı. Lütfen tekrar deneyin."), "error");
    setBusy(null);
  }

  async function doRestore() {
    if (!userId) return;
    setBusy("restore");
    try {
      const ok = await restore(userId);
      toast(ok ? t("Aboneliğin geri yüklendi.") : t("Geri yüklenecek bir abonelik bulunamadı."), ok ? "ok" : "info");
      if (ok) await waitForPremium();
    } catch {
      toast(t("Geri yükleme başarısız oldu."), "error");
    }
    setBusy(null);
  }

  const benefits = [
    t("Çok daha yüksek günlük yapay zekâ limiti: fotoğraf, yazı, etiket, buzdolabı ve tarif analizleri"),
    t("Beslenme asistanıyla daha fazla sohbet"),
    t("Tüm özellikler tek abonelikte; reklam yok"),
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Celebration open={celebrate} onClose={() => setCelebrate(false)} />
      <PageHeader title={t("BKNY Premium")} back={
          <Link href="/profile" aria-label={t("Geri")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
            <ArrowLeft size={18} />
          </Link>
        }
      />
      <Card className="space-y-3 bg-gradient-to-br from-primary-soft/70 via-surface to-surface">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white">
            <Crown size={22} />
          </span>
          <div>
            <p className="font-semibold">{premium ? t("Premium üyesin") : t("Premium'a geç")}</p>
            <p className="text-xs text-muted">{premium ? t("Teşekkürler! Limitlerin artırıldı.") : t("Ücretsiz plan her zaman kullanılabilir.")}</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-primary" />
              {b}
            </li>
          ))}
        </ul>
        {config && (
          <p className="text-xs text-muted">
            {t("Bugünkü yapay zekâ kullanımın: {u} / {l}", { u: config.quota.used, l: config.quota.limit })}
          </p>
        )}
      </Card>

      {premium ? (
        <Card className="space-y-2">
          <p className="text-sm text-muted">{t("Aboneliğini, mağazanın kendi ekranından yönetebilir veya iptal edebilirsin.")}</p>
          <a href={manageUrl()} target="_blank" rel="noreferrer" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold">
            {t("Aboneliği yönet")}
          </a>
        </Card>
      ) : native ? (
        <Card className="space-y-3">
          {plans === null && <p className="text-sm text-muted">{t("Planlar yükleniyor…")} <span className="text-[11px]">({step} · {secs} sn)</span></p>}
          {plans && plans.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">{t("Abonelik planları şu anda yüklenemedi. Mağaza ürünleri yeni açıldıysa birkaç saat sürebilir; daha sonra tekrar deneyin.")}</p>
              {loadError && <p className="break-words rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-muted">{loadError.slice(0, 240)}</p>}
              <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                {t("Tekrar dene")}
              </Button>
            </div>
          )}
          {plans?.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  {p.kind === "annual" ? t("Yıllık") : p.kind === "monthly" ? t("Aylık") : p.title}
                  {p.kind === "annual" && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Sparkles size={11} />
                      {t("Avantajlı")}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">
                  {p.price}
                  {p.kind === "annual" ? ` / ${t("yıl")}` : p.kind === "monthly" ? ` / ${t("ay")}` : ""}
                </p>
                {p.intro && <p className="text-xs text-primary">{t("Başlangıç teklifi")}: {p.intro}</p>}
              </div>
              <Button loading={busy === p.id} disabled={!!busy} onClick={() => purchase(p.id)}>
                {t("Abone ol")}
              </Button>
            </div>
          ))}
          <Button variant="secondary" className="w-full" loading={busy === "restore"} disabled={!!busy} onClick={doRestore}>
            {t("Satın alımları geri yükle")}
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm">{t("Premium abonelik, BKNY mobil uygulaması üzerinden satın alınır. Uygulamayı indirip aynı hesapla giriş yaptığında Premium burada da etkinleşir.")}</p>
          <div className="flex gap-2 text-sm font-medium text-muted">
            <span className="inline-flex items-center gap-1.5"><AppleIcon size={16} />App Store</span>
            <span className="inline-flex items-center gap-1.5"><AndroidIcon size={16} />Google Play</span>
          </div>
        </Card>
      )}

      {diag && <p className="break-words font-mono text-[10px] text-muted/70">{diag}</p>}
      {log.length > 0 && <pre className="whitespace-pre-wrap break-words font-mono text-[10px] text-muted/70">{log.join("\n")}</pre>}

      <p className="text-[11px] leading-relaxed text-muted">
        {t("Abonelik, satın alma onayında seçtiğin süre sonunda otomatik olarak yenilenir; yenileme tutarı hesabından (Apple Kimliği ya da Google Play) tahsil edilir. Aboneliği, yenileme tarihinden en az 24 saat önce mağaza hesap ayarlarından iptal edebilirsin; iptal, mevcut dönemin sonunda geçerli olur. Ücretsiz deneme sunulursa, süre dolmadan iptal etmezsen abonelik ücretli olarak başlar.")}{" "}
        <Link href="/terms" className="underline">{t("Kullanım koşulları")}</Link> · <Link href="/privacy" className="underline">{t("Gizlilik")}</Link>
      </p>
    </div>
  );
}
