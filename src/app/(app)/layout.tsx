"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, BookOpen, CalendarDays, CalendarHeart, ChefHat, CircleDot, CloudOff, Droplets, GlassWater, Home, Lightbulb, Mail, MessageCircle, Moon, Pill, Plus, Refrigerator, RefreshCw, Ruler, Shield, Stethoscope, Timer, Trophy, User, Users, UtensilsCrossed } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { cycleAvailable } from "@/lib/bkn/cycle";
import { supabaseConfigured } from "@/lib/supabase/client";
import { cx } from "@/components/ui";
import { Logo } from "@/components/logo";
import { ReminderTicker } from "@/components/reminder-ticker";
import { NativePush } from "@/components/native-push";
import { RamadanPrompt } from "@/components/ramadan-prompt";
import { HealthAutoSync } from "@/components/health-auto-sync";
import { HealthPrompt } from "@/components/health-prompt";
import { TimezoneSync } from "@/components/timezone-sync";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" role="status" aria-label="Yükleniyor" />
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h1 className="text-lg font-bold">Kurulum tamamlanmadı</h1>
        <p className="mt-2 text-sm text-muted">
          Supabase bağlantı bilgileri tanımlı değil. <code>.env.local</code> dosyasına <code>NEXT_PUBLIC_SUPABASE_URL</code> ve <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> değerlerini ekleyip uygulamayı yeniden
          başlatın. Ayrıntılar için README dosyasına bakın.
        </p>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, session, profile, profileLoaded, t, online, pending, config } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname === "/onboarding";
  // Yönetim paneli, profilini tamamlamamış yönetici hesabıyla da açılabilir.
  const needsOnboarding = !!session && profileLoaded && !profile?.onboarded_at && !pathname.startsWith("/admin");

  useEffect(() => {
    if (!ready || !supabaseConfigured) return;
    if (!session) router.replace("/login");
    else if (needsOnboarding && !onboarding) router.replace("/onboarding");
    else if (profile?.onboarded_at && onboarding) router.replace("/");
  }, [ready, session, needsOnboarding, onboarding, profile?.onboarded_at, router]);

  if (!supabaseConfigured) return <SetupNotice />;
  if (!ready || !session || (!profile && !profileLoaded) || (needsOnboarding && !onboarding)) return <Splash />;
  if (onboarding) return <main className="mx-auto min-h-dvh w-full max-w-lg px-4 py-6">{children}</main>;

  const side = [
    { href: "/", icon: Home, label: t("Ana sayfa") },
    { href: "/diary", icon: BookOpen, label: t("Günlük") },
    { href: "/add", icon: Plus, label: t("Kayıt ekle") },
    { href: "/water", icon: Droplets, label: t("Su") },
    { href: "/drinks", icon: GlassWater, label: t("İçecekler") },
    { href: "/supplements", icon: Pill, label: t("Takviyeler") },
    { href: "/activity", icon: Activity, label: t("Aktivite") },
    { href: "/rings", icon: CircleDot, label: t("Sağlık halkaları") },
    { href: "/body", icon: Ruler, label: t("Ölçümler") },
    { href: "/wellbeing", icon: Moon, label: t("Uyku ve durum") },
    { href: "/fasting", icon: Timer, label: t("Aralıklı oruç") },
    { href: "/coach", icon: Lightbulb, label: t("Öneriler") },
    { href: "/plan", icon: CalendarDays, label: t("Öğün planı") },
    { href: "/recipes", icon: ChefHat, label: t("Tariflerim") },
    { href: "/fridge", icon: Refrigerator, label: t("Buzdolabından yemeğe") },
    { href: "/eating-out", icon: UtensilsCrossed, label: t("Dışarıda yemek") },
    { href: "/challenges", icon: Users, label: t("Meydan okumalar") },
    ...(cycleAvailable(profile?.sex) ? [{ href: "/cycle", icon: CalendarHeart, label: t("Döngü takibi") }] : []),
    { href: "/stats", icon: BarChart3, label: t("İstatistikler") },
    { href: "/performance", icon: Trophy, label: t("Performans") },
    { href: "/letter", icon: Mail, label: t("Haftalık mektup") },
    { href: "/assistant", icon: MessageCircle, label: t("Asistan") },
    { href: "/dietitian", icon: Stethoscope, label: t("Diyetisyen paneli") },
    { href: "/profile", icon: User, label: t("Profil") },
    ...(config?.is_admin ? [{ href: "/admin", icon: Shield, label: t("Yönetim") }] : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const tab = (href: string, Icon: typeof Home, label: string) => (
    <Link
      href={href}
      aria-current={isActive(href) ? "page" : undefined}
      className={cx("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive(href) ? "text-primary" : "text-muted")}
    >
      <Icon size={22} strokeWidth={isActive(href) ? 2.4 : 2} />
      {label}
    </Link>
  );

  return (
    <div className="lg:flex">
      <ReminderTicker />
      <NativePush />
      <RamadanPrompt />
      <HealthAutoSync />
      <HealthPrompt />
      <TimezoneSync />
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface p-4 lg:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          <Logo size={38} />
          <span className="leading-tight">
            <span className="block text-lg font-bold tracking-tight">BKNY</span>
            <span className="block text-[10px] text-muted">{t("Bugün kendin için ne yaptın?")}</span>
          </span>
        </div>
        {side.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={isActive(s.href) ? "page" : undefined}
            className={cx("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium", isActive(s.href) ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-text")}
          >
            <s.icon size={19} />
            {s.label}
          </Link>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        {(!online || pending > 0) && (
          <div className="no-print flex items-center justify-center gap-2 bg-warn/15 px-4 py-1.5 text-center text-xs font-medium text-warn">
            {!online ? <CloudOff size={14} /> : <RefreshCw size={14} className="animate-spin" />}
            {!online
              ? pending > 0
                ? t("Çevrimdışısınız · {n} kayıt bağlantı gelince gönderilecek", { n: pending })
                : t("Çevrimdışısınız · kayıtlarınız cihazda saklanıp sonra gönderilecek")
              : t("{n} kayıt eşitleniyor…", { n: pending })}
          </div>
        )}
        {config?.announcement && <div className="no-print bg-primary-soft px-4 py-1.5 text-center text-xs font-medium text-primary">{config.announcement}</div>}
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 lg:max-w-5xl lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden" aria-label={t("Ana menü")}>
        <div className="mx-auto flex h-16 max-w-3xl items-stretch">
          {tab("/", Home, t("Ana sayfa"))}
          {tab("/diary", BookOpen, t("Günlük"))}
          <div className="flex flex-1 items-center justify-center">
            <Link href="/add" aria-label={t("Kayıt ekle")} className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg shadow-primary/30">
              <Plus size={28} />
            </Link>
          </div>
          {tab("/stats", BarChart3, t("İstatistikler"))}
          {tab("/profile", User, t("Profil"))}
        </div>
      </nav>
    </div>
  );
}
