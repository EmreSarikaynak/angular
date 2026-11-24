"use client";
import { mealLabel } from "@/lib/bkn/ramadan";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity as ActivityIcon, Barcode, Camera, Droplets, Flame, Footprints, MessageCircle, Plus, Scale, Type, Utensils } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Ring, Skeleton } from "@/components/ui";
import { useBody, useDay } from "@/lib/data/hooks";
import { addWater } from "@/lib/data/actions";
import { summarizeDay } from "@/lib/day";
import { formatDate, toDateKey } from "@/lib/dates";
import { goalProgress } from "@/lib/nutrition/calc";
import { numberFmt } from "@/lib/i18n";
import { ACTIVITY_LABELS, label } from "@/lib/i18n/labels";
import { setPendingPhoto } from "@/lib/image";
import { BknToday } from "@/components/bkn-today";
import { InstallHint } from "@/components/install-hint";
import { DietitianNoteCard } from "@/components/my-dietitian";
import { MEALS } from "@/lib/types";

export default function DashboardPage() {
  const { t, lang, profile, toast, online, config } = useApp();
  const router = useRouter();
  const today = toDateKey();
  const day = useDay(today);
  const body = useBody();

  const data = day.data ?? { food: [], water: [], activities: [], daily: [], rings: [] };
  const s = summarizeDay(today, data, profile);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const waterTarget = profile?.water_target_ml ?? 2000;
  const lastWeight = [...(body.data ?? [])].reverse().find((b) => b.weight_kg != null)?.weight_kg ?? profile?.weight_kg ?? null;
  const progress = goalProgress(profile?.start_weight_kg ?? null, lastWeight, profile?.target_weight_kg ?? null);
  const over = s.remaining_kcal < 0;
  const aiReady = online && config?.ai_available !== false;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? t("İyi geceler") : hour < 12 ? t("Günaydın") : hour < 18 ? t("İyi günler") : t("İyi akşamlar");

  async function quickWater(ml: number) {
    try {
      const { queued } = await addWater(today, ml);
      toast(queued ? t("{n} ml cihaza kaydedildi", { n: ml }) : t("{n} ml su eklendi", { n: ml }), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  const macro = (name: string, value: number, target: number | null | undefined, color: string) => {
    const pct = target ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
    return (
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted">{name}</p>
        <p className="text-[13px] font-semibold leading-tight">
          {nf(value)}
          <span className="font-normal text-muted">/{target ?? "–"}</span>
        </p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width .4s ease" }} />
        </div>
      </div>
    );
  };
  const mini = (label: string, value: string, unit?: string, color?: string) => (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="truncate text-base font-semibold leading-tight" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-normal text-muted">{unit}</span>}
      </p>
    </div>
  );
  const tile = (href: string, icon: React.ReactNode, labelText: string, value: string, sub: string, pct: number, color: string) => (
    <Link href={href} className="min-w-0 rounded-2xl border border-border bg-surface p-3 shadow-sm transition active:scale-[.98]">
      <p className="flex items-center gap-1 text-[11px] text-muted" style={{ color }}>
        {icon}
        <span className="truncate text-muted">{labelText}</span>
      </p>
      <p className="mt-1 truncate text-lg font-bold leading-none">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted">{sub}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: "width .4s ease" }} />
      </div>
    </Link>
  );
  const waterPct = waterTarget ? (s.water_ml / waterTarget) * 100 : 0;
  const stepsTarget = profile?.steps_target ?? 0;

  return (
    <div className="space-y-3">
      <InstallHint />
      <input
        id="bt-home-camera"
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setPendingPhoto(f, "photo");
            router.push("/add?mode=photo");
          }
        }}
      />
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{formatDate(today, lang)}</p>
          <h1 className="truncate text-lg font-bold leading-tight tracking-tight">{profile?.first_name ? `${greeting}, ${profile.first_name}` : greeting}</h1>
        </div>
        <Link href="/assistant" aria-label={t("Asistan")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <MessageCircle size={19} />
        </Link>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="bg-gradient-to-br from-primary-soft/70 via-surface to-surface p-3.5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <Ring size={116} stroke={10} value={s.intake.kcal} max={s.budget_kcal} label={t("Kalori: {a} / {b} kcal", { a: Math.round(s.intake.kcal), b: s.budget_kcal })}>
              <span className={`text-xl font-bold leading-none ${over ? "text-danger" : ""}`}>{nf(Math.abs(s.remaining_kcal))}</span>
              <span className="mt-0.5 text-[10px] text-muted">{over ? t("kcal fazla") : t("kcal kaldı")}</span>
            </Ring>
            <div className="grid min-w-0 flex-1 gap-1.5">
              {mini(t("Günlük hedef"), nf(s.target_kcal), "kcal")}
              {mini(t("Alınan"), nf(s.intake.kcal), "kcal")}
              {mini(s.burned_source === "rings" ? t("Yakılan (saatinizden)") : t("Sporla yakılan (tahmini)"), nf(s.burned_kcal), "kcal", "var(--burn)")}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {macro(t("Protein"), s.intake.protein_g, profile?.protein_target_g, "var(--protein)")}
            {macro(t("Karb."), s.intake.carbs_g, profile?.carbs_target_g, "var(--carbs)")}
            {macro(t("Yağ"), s.intake.fat_g, profile?.fat_target_g, "var(--fat)")}
            {macro(t("Lif"), s.intake.fiber_g, profile?.fiber_target_g, "var(--fiber)")}
          </div>
          {profile?.add_exercise_calories && s.burned_kcal > 0 && <p className="mt-2 text-[11px] text-muted">{t("Yakılan {n} kcal günlük bütçenize eklendi.", { n: s.burned_kcal })}</p>}
        </Card>

        <div className="grid grid-cols-5 gap-2 self-start">
          {[
            { icon: <Camera size={19} />, label: t("Fotoğraf"), onClick: () => document.getElementById("bt-home-camera")?.click(), primary: true, disabled: !aiReady, tint: "" },
            { icon: <Type size={19} />, label: t("Yazarak"), onClick: () => router.push("/add?mode=text"), disabled: !aiReady, tint: "bg-protein/15 text-protein" },
            { icon: <Barcode size={19} />, label: t("Barkod"), onClick: () => router.push("/add?mode=barcode"), disabled: !online, tint: "bg-carbs/15 text-carbs" },
            { icon: <Droplets size={19} />, label: "+250 ml", onClick: () => quickWater(250), tint: "bg-water/15 text-water" },
            { icon: <Plus size={19} />, label: t("Daha fazla"), onClick: () => router.push("/add"), tint: "bg-surface-2 text-muted" },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-0.5 py-2.5 text-[11px] font-medium shadow-sm transition active:scale-[.97] disabled:opacity-45 ${a.primary ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-full ${a.primary ? "bg-white/20" : a.tint}`}>{a.icon}</span>
              <span className="max-w-full truncate">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tile("/water", <Droplets size={13} />, t("Su"), nf(s.water_ml), s.water_ml >= waterTarget ? t("Hedef tamamlandı") : `/ ${nf(waterTarget)} ml`, waterPct, "var(--water)")}
        {tile("/activity", <Footprints size={13} />, t("Adım"), nf(s.steps), `/ ${nf(stepsTarget)}`, stepsTarget ? (s.steps / stepsTarget) * 100 : 0, "var(--burn)")}
        {tile(
          "/body",
          <Scale size={13} />,
          t("Güncel kilo"),
          lastWeight != null ? `${nf(lastWeight, 1)} kg` : "–",
          profile?.target_weight_kg != null ? `${t("Hedef")} ${nf(profile.target_weight_kg, 1)} kg` : " ",
          progress ?? 0,
          "var(--primary)",
        )}
      </div>

      {data.activities.length > 0 && (
        <Link href="/activity" className="block rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
          {data.activities.slice(0, 2).map((a) => (
            <p key={a.id} className="flex items-center justify-between gap-2 py-0.5 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <ActivityIcon size={13} className="shrink-0 text-burn" />
                <span className="truncate">
                  {a.name || label(ACTIVITY_LABELS, a.type, lang)} · {a.duration_min} {t("dk")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 font-medium text-burn">
                <Flame size={12} />
                {nf(a.kcal_burned)}
              </span>
            </p>
          ))}
        </Link>
      )}

      <DietitianNoteCard />
      <BknToday date={today} summary={s} data={data} />

      <Card className="p-3.5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("Bugünkü öğünler")}</h2>
          <Link href="/diary" className="text-sm font-medium text-primary">
            {t("Günlüğü aç")}
          </Link>
        </div>
        {day.loading && !day.data ? (
          <Skeleton className="h-14" />
        ) : data.food.length === 0 ? (
          <div className="flex items-center justify-between gap-3 py-1.5">
            <p className="min-w-0 text-sm text-muted">
              <Utensils size={14} className="mr-1.5 inline align-[-2px]" />
              {t("Bugün henüz kayıt yok")}
            </p>
            <Button size="sm" onClick={() => router.push("/add")}>
              <Plus size={16} />
              {t("Kayıt ekle")}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {MEALS.map((m) => {
              const list = data.food.filter((f) => f.meal === m);
              if (!list.length) return null;
              return (
                <Link key={m} href="/diary" className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{mealLabel(m, lang, profile?.ramadan_mode)}</p>
                    <p className="truncate text-xs text-muted">{list.map((f) => f.name).join(", ")}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">
                    {nf(list.reduce((x, f) => x + f.kcal, 0))} <span className="text-xs font-normal text-muted">kcal</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
