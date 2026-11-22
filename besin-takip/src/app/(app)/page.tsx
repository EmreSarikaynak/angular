"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity as ActivityIcon, Barcode, Camera, ChevronRight, Droplets, Flame, Footprints, MessageCircle, Plus, Scale, Type, Utensils } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Bar, Button, Card, Empty, Ring, Skeleton, Stat } from "@/components/ui";
import { useBody, useDay } from "@/lib/data/hooks";
import { addWater } from "@/lib/data/actions";
import { summarizeDay } from "@/lib/day";
import { formatDate, toDateKey } from "@/lib/dates";
import { goalProgress } from "@/lib/nutrition/calc";
import { numberFmt } from "@/lib/i18n";
import { ACTIVITY_LABELS, MEAL_LABELS, label } from "@/lib/i18n/labels";
import { setPendingPhoto } from "@/lib/image";
import { MEALS } from "@/lib/types";

export default function DashboardPage() {
  const { t, lang, profile, toast, online, config } = useApp();
  const router = useRouter();
  const today = toDateKey();
  const day = useDay(today);
  const body = useBody();

  const data = day.data ?? { food: [], water: [], activities: [], daily: [] };
  const s = summarizeDay(today, data, profile);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const waterTarget = profile?.water_target_ml ?? 2000;
  const lastWeight = [...(body.data ?? [])].reverse().find((b) => b.weight_kg != null)?.weight_kg ?? profile?.weight_kg ?? null;
  const progress = goalProgress(profile?.start_weight_kg ?? null, lastWeight, profile?.target_weight_kg ?? null);
  const over = s.remaining_kcal < 0;
  const aiReady = online && config?.ai_available !== false;

  async function quickWater(ml: number) {
    try {
      const { queued } = await addWater(today, ml);
      toast(queued ? t("{n} ml cihaza kaydedildi", { n: ml }) : t("{n} ml su eklendi", { n: ml }), queued ? "info" : "ok");
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  const macro = (name: string, value: number, target: number | null | undefined, color: string) => (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-1">
        <span className="truncate text-xs text-muted">{name}</span>
        <span className="shrink-0 text-xs font-semibold">
          {nf(value)}
          <span className="font-normal text-muted">/{target ?? "–"} g</span>
        </span>
      </div>
      <Bar value={value} max={target ?? 0} color={color} />
    </div>
  );

  return (
    <div className="space-y-4">
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
          <p className="truncate text-sm text-muted">{formatDate(today, lang)}</p>
          <h1 className="truncate text-xl font-bold tracking-tight">{profile?.first_name ? t("Merhaba, {name}", { name: profile.first_name }) : t("Merhaba")}</h1>
        </div>
        <Link href="/assistant" aria-label={t("Asistan")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <MessageCircle size={20} />
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4">
            <Ring value={s.intake.kcal} max={s.budget_kcal} label={t("Kalori: {a} / {b} kcal", { a: Math.round(s.intake.kcal), b: s.budget_kcal })}>
              <span className={`text-2xl font-bold ${over ? "text-danger" : ""}`}>{nf(Math.abs(s.remaining_kcal))}</span>
              <span className="text-[11px] text-muted">{over ? t("kcal fazla") : t("kcal kaldı")}</span>
            </Ring>
            <div className="grid min-w-0 flex-1 gap-2.5">
              <Stat label={t("Günlük hedef")} value={nf(s.target_kcal)} unit="kcal" />
              <Stat label={t("Alınan")} value={nf(s.intake.kcal)} unit="kcal" />
              <Stat label={t("Sporla yakılan (tahmini)")} value={nf(s.burned_kcal)} unit="kcal" color="var(--burn)" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            {macro(t("Protein"), s.intake.protein_g, profile?.protein_target_g, "var(--protein)")}
            {macro(t("Karb."), s.intake.carbs_g, profile?.carbs_target_g, "var(--carbs)")}
            {macro(t("Yağ"), s.intake.fat_g, profile?.fat_target_g, "var(--fat)")}
          </div>
          {profile?.add_exercise_calories && s.burned_kcal > 0 && <p className="mt-3 text-xs text-muted">{t("Yakılan {n} kcal günlük bütçenize eklendi.", { n: s.burned_kcal })}</p>}
        </Card>

        <div className="grid grid-cols-4 gap-2 self-start">
          {[
            { icon: <Camera size={22} />, label: t("Fotoğraf"), onClick: () => document.getElementById("bt-home-camera")?.click(), primary: true, disabled: !aiReady },
            { icon: <Type size={22} />, label: t("Yazarak"), onClick: () => router.push("/add?mode=text"), disabled: !aiReady },
            { icon: <Barcode size={22} />, label: t("Barkod"), onClick: () => router.push("/add?mode=barcode"), disabled: !online },
            { icon: <Droplets size={22} />, label: "+250 ml", onClick: () => quickWater(250) },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-xs font-medium disabled:opacity-45 ${a.primary ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
          <Link href="/add" className="col-span-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-sm font-medium text-muted">
            <Plus size={16} />
            {t("Tüm kayıt seçenekleri")}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <Link href="/water" className="flex items-center gap-4">
            <Ring value={s.water_ml} max={waterTarget} size={84} stroke={9} color="var(--water)" overColor="var(--water)" label={t("Su: {a} / {b} ml", { a: s.water_ml, b: waterTarget })}>
              <span className="text-sm font-bold">{waterTarget ? Math.min(999, Math.round((s.water_ml / waterTarget) * 100)) : 0}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs text-muted">
                <Droplets size={14} /> {t("Su")}
              </p>
              <p className="text-lg font-semibold">
                {nf(s.water_ml)} <span className="text-xs font-normal text-muted">/ {nf(waterTarget)} ml</span>
              </p>
              <p className="text-xs text-muted">{s.water_ml >= waterTarget ? t("Hedef tamamlandı") : t("{n} ml kaldı", { n: nf(waterTarget - s.water_ml) })}</p>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        </Card>

        <Card>
          <Link href="/activity" className="block">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-muted">
                <Footprints size={14} /> {t("Adım")}
              </p>
              <ChevronRight size={18} className="text-muted" />
            </div>
            <p className="mt-1 text-lg font-semibold">
              {nf(s.steps)} <span className="text-xs font-normal text-muted">/ {nf(profile?.steps_target ?? 0)}</span>
            </p>
            <Bar value={s.steps} max={profile?.steps_target ?? 0} color="var(--burn)" className="mt-2" />
            <div className="mt-3 space-y-1">
              {data.activities.length === 0 ? (
                <p className="text-xs text-muted">{t("Bugün aktivite kaydı yok.")}</p>
              ) : (
                data.activities.slice(0, 3).map((a) => (
                  <p key={a.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <ActivityIcon size={13} className="text-burn" />
                      {a.name || label(ACTIVITY_LABELS, a.type, lang)} · {a.duration_min} {t("dk")}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 font-medium text-burn">
                      <Flame size={12} />
                      {nf(a.kcal_burned)}
                    </span>
                  </p>
                ))
              )}
            </div>
          </Link>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1">
          <Link href="/body" className="block">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-muted">
                <Scale size={14} /> {t("Güncel kilo")}
              </p>
              <ChevronRight size={18} className="text-muted" />
            </div>
            <p className="mt-1 text-lg font-semibold">
              {lastWeight != null ? nf(lastWeight, 1) : "–"} <span className="text-xs font-normal text-muted">kg</span>
            </p>
            {profile?.target_weight_kg != null && (
              <>
                <Bar value={progress ?? 0} max={100} className="mt-2" />
                <p className="mt-1.5 flex justify-between text-xs text-muted">
                  <span>
                    {t("Başlangıç")} {profile.start_weight_kg != null ? nf(profile.start_weight_kg, 1) : "–"} kg
                  </span>
                  <span className="font-medium text-text">{progress ?? 0}%</span>
                  <span>
                    {t("Hedef")} {nf(profile.target_weight_kg, 1)} kg
                  </span>
                </p>
              </>
            )}
          </Link>
        </Card>
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">{t("Bugünkü öğünler")}</h2>
          <Link href="/diary" className="text-sm font-medium text-primary">
            {t("Günlüğü aç")}
          </Link>
        </div>
        {day.loading && !day.data ? (
          <Skeleton className="h-20" />
        ) : data.food.length === 0 ? (
          <Empty
            icon={<Utensils size={22} />}
            title={t("Bugün henüz kayıt yok")}
            text={t("İlk öğününüzü fotoğrafla ya da yazarak ekleyin.")}
            action={
              <Button size="sm" onClick={() => router.push("/add")}>
                <Plus size={16} />
                {t("Kayıt ekle")}
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {MEALS.map((m) => {
              const list = data.food.filter((f) => f.meal === m);
              if (!list.length) return null;
              return (
                <Link key={m} href="/diary" className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label(MEAL_LABELS, m, lang)}</p>
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
