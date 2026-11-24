"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Crown, MessageCircleHeart, Sparkles, Zap } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Bar, Button, Card, PageHeader } from "@/components/ui";
import { Celebration } from "@/components/celebration";
import { AndroidIcon, AppleIcon } from "@/components/platform-icons";
import { buy, billingAvailable, loadPlans, manageUrl, restore, type PlanOption } from "@/lib/billing";
import { isNative } from "@/lib/native";
import { dayOfYear, useOwnerMessages } from "@/components/owner-messages";

export default function PremiumPage() {
  const { t, toast, config, refreshConfig, session } = useApp();
  const userId = session?.user.id ?? null;
  const [native, setNative] = useState(false);
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const premium = !!config?.premium;
  const owner = !!config?.owner;
  const ownerMsgs = useOwnerMessages();
  const [msgShift, setMsgShift] = useState(0);

  useEffect(() => {
    setNative(isNative());
    if (!userId) return;
    if (!billingAvailable()) {
      setLoadError("billing_unavailable");
      setPlans([]);
      return;
    }
    setLoadError(null);
    setPlans(null);
    loadPlans(userId)
      .then(setPlans)
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "unknown");
        setPlans([]);
      });
  }, [userId, attempt]);

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
    { icon: Zap, title: t("Kat kat daha fazla analiz"), text: t("Fotoğraf, etiket, buzdolabı ve tarif analizleri için günlük limitin ücretsiz plandan çok daha yüksek.") },
    { icon: MessageCircleHeart, title: t("Asistanın hep yanında"), text: t("Beslenme asistanıyla dilediğin kadar sohbet et; öğünlerin ve hedeflerin için kişisel öneriler al.") },
    { icon: BadgeCheck, title: t("Tek abonelik, sıfır reklam"), text: t("Tüm özellikler tek pakette. Reklam ve izleme yok; istediğin an iptal edebilirsin.") },
  ];

  const used = config?.quota.used ?? 0;
  const limit = config?.quota.limit ?? 0;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Celebration open={celebrate} onClose={() => setCelebrate(false)} />
      <PageHeader
        title={t("BKNY Premium")}
        back={
          <Link href="/profile" aria-label={t("Geri")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">
            <ArrowLeft size={18} />
          </Link>
        }
      />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-primary to-teal-500 p-6 text-center text-white shadow-xl">
        <span aria-hidden className="bt-shimmer pointer-events-none absolute inset-0" />
        {[
          ["8%", "14%", "0s", 14],
          ["86%", "20%", "0.8s", 18],
          ["18%", "74%", "1.4s", 12],
          ["80%", "70%", "0.4s", 16],
        ].map(([l, tp, d, sz], i) => (
          <Sparkles key={i} aria-hidden size={sz as number} className="bt-twinkle absolute text-white/80" style={{ left: l as string, top: tp as string, animationDelay: d as string }} />
        ))}
        <div className="relative">
          <span className="bt-glow bt-float mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white/20 backdrop-blur">
            <Crown size={40} />
          </span>
          <h2 className="bt-gradient-text mt-4 text-3xl font-black tracking-tight">{owner ? t("Kurucu · Premium") : premium ? t("Premium üyesin") : t("Premium'a geç")}</h2>
          {owner ? (
            <button key={msgShift} type="button" onClick={() => setMsgShift((n) => n + 1)} className="bt-rise mx-auto mt-2 block max-w-xs text-sm font-medium text-white/95" aria-label={t("Başka bir söz")}>
              “{ownerMsgs[(dayOfYear() + msgShift) % ownerMsgs.length]}”
            </button>
          ) : (
            <p className="mt-1 text-sm text-white/85">{premium ? t("Teşekkürler! Tüm Premium ayrıcalıkların aktif.") : t("Daha fazla analiz, daha fazla sohbet, sıfır reklam.")}</p>
          )}
          {premium && limit > 0 && (
            <div className="mx-auto mt-4 max-w-xs text-left">
              <div className="mb-1 flex justify-between text-xs text-white/85">
                <span>{t("Bugünkü yapay zekâ kullanımın")}</span>
                <span className="font-semibold">
                  {used} / {limit}
                </span>
              </div>
              <Bar value={used} max={limit} color="#ffffff" />
            </div>
          )}
        </div>
      </div>

      {/* Avantajlar: sırayla uçarak gelen üç kutu */}
      <div className="grid gap-3">
        {benefits.map((b, i) => (
          <div key={b.title} className={`bt-fly flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm ${i % 2 ? "bt-fly-r" : "bt-fly-l"}`} style={{ animationDelay: `${i * 160 + 150}ms` }}>
            <span className="bt-float grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary" style={{ animationDelay: `${i * 0.6}s` }}>
              <b.icon size={22} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{b.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      {premium ? (
        <Card className="space-y-2">
          <p className="text-sm text-muted">{t("Aboneliğini, mağazanın kendi ekranından yönetebilir veya iptal edebilirsin.")}</p>
          <a href={manageUrl()} target="_blank" rel="noreferrer" className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold">
            {t("Aboneliği yönet")}
          </a>
        </Card>
      ) : native ? (
        <div className="space-y-3">
          {plans === null && <div className="bt-pulse h-24 rounded-2xl bg-surface-2" aria-label={t("Planlar yükleniyor…")} />}
          {plans && plans.length === 0 && (
            <Card className="space-y-2">
              <p className="text-sm text-muted">{t("Abonelik planları şu anda yüklenemedi. Mağaza ürünleri yeni açıldıysa birkaç saat sürebilir; daha sonra tekrar deneyin.")}</p>
              {loadError && <p className="break-words rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-muted">{loadError.slice(0, 160)}</p>}
              <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                {t("Tekrar dene")}
              </Button>
            </Card>
          )}
          {plans?.map((p, i) => (
            <div
              key={p.id}
              className={`bt-fly bt-fly-up relative flex items-center justify-between gap-3 rounded-2xl p-4 ${p.kind === "annual" ? "border-2 border-primary bg-primary-soft/50 shadow-md" : "border border-border bg-surface"}`}
              style={{ animationDelay: `${i * 140 + 650}ms` }}
            >
              {p.kind === "annual" && (
                <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  <Sparkles size={11} />
                  {t("Avantajlı")}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-semibold">{p.kind === "annual" ? t("Yıllık") : p.kind === "monthly" ? t("Aylık") : p.title}</p>
                <p className="text-sm text-muted">
                  {p.price}
                  {p.kind === "annual" ? ` / ${t("yıl")}` : p.kind === "monthly" ? ` / ${t("ay")}` : ""}
                </p>
                {p.intro && (
                  <p className="text-xs text-primary">
                    {t("Başlangıç teklifi")}: {p.intro}
                  </p>
                )}
              </div>
              <Button loading={busy === p.id} disabled={!!busy} onClick={() => purchase(p.id)}>
                {t("Abone ol")}
              </Button>
            </div>
          ))}
          <Button variant="secondary" className="w-full" loading={busy === "restore"} disabled={!!busy} onClick={doRestore}>
            {t("Satın alımları geri yükle")}
          </Button>
        </div>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm">{t("Premium abonelik, BKNY mobil uygulaması üzerinden satın alınır. Uygulamayı indirip aynı hesapla giriş yaptığında Premium burada da etkinleşir.")}</p>
          <div className="flex gap-3 text-sm font-medium text-muted">
            <span className="inline-flex items-center gap-1.5">
              <AppleIcon size={16} />
              App Store
            </span>
            <span className="inline-flex items-center gap-1.5">
              <AndroidIcon size={16} />
              Google Play
            </span>
          </div>
        </Card>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        {t("Abonelik, satın alma onayında seçtiğin süre sonunda otomatik olarak yenilenir; yenileme tutarı hesabından (Apple Kimliği ya da Google Play) tahsil edilir. Aboneliği, yenileme tarihinden en az 24 saat önce mağaza hesap ayarlarından iptal edebilirsin; iptal, mevcut dönemin sonunda geçerli olur. Ücretsiz deneme sunulursa, süre dolmadan iptal etmezsen abonelik ücretli olarak başlar.")}{" "}
        <Link href="/terms" className="underline">
          {t("Kullanım koşulları")}
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          {t("Gizlilik")}
        </Link>
      </p>
    </div>
  );
}
