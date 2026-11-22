"use client";
import { Suspense, useMemo, useState } from "react";
import { Activity as ActivityIcon, Flame, Footprints, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { DateNav, useDateParam } from "@/components/date-nav";
import { Bar, Button, Card, Chip, Empty, Field, Input, NumberInput, PageHeader, Segmented, Stat } from "@/components/ui";
import { useDay } from "@/lib/data/hooks";
import { saveDaily } from "@/lib/data/actions";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { summarizeDay } from "@/lib/day";
import { timeOf, timestampFor } from "@/lib/dates";
import { numberFmt } from "@/lib/i18n";
import { ACTIVITY_LABELS, INTENSITY_LABELS, label } from "@/lib/i18n/labels";
import { ACTIVITY_TYPES, activityKcal, activityType, metFor } from "@/lib/nutrition/activities";
import type { Intensity } from "@/lib/types";

function ActivityInner() {
  const { t, lang, profile, saveProfile, toast } = useApp();
  const [date, setDate] = useDateParam();
  const day = useDay(date);
  const [type, setType] = useState("walking");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<number | null>(30);
  const [distance, setDistance] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<number | null>(null);
  const [stepsTouched, setStepsTouched] = useState(false);

  const data = day.data ?? { food: [], water: [], activities: [], daily: [], rings: [] };
  const daily = data.daily[0];
  const s = summarizeDay(date, data, profile);
  const weight = profile?.weight_kg ?? 70;
  const at = activityType(type);
  const nf = (n: number, d = 0) => numberFmt(lang, n, d);
  const met = useMemo(() => metFor(type, intensity, duration ?? 0, at.hasDistance ? distance : null), [type, intensity, duration, distance, at.hasDistance]);
  const kcal = activityKcal(met, weight, duration ?? 0);
  const stepsValue = stepsTouched ? steps : (daily?.steps ?? null);

  async function save() {
    if (!duration || duration < 1 || duration > 1440) return toast(t("Süre 1–1440 dakika arasında olmalı."), "error");
    setBusy(true);
    try {
      const { queued } = await upsertRow("activities", {
        id: uuid(),
        entry_date: date,
        started_at: timestampFor(date),
        type,
        name: type === "other" ? name.trim().slice(0, 120) || null : null,
        duration_min: duration,
        distance_km: at.hasDistance && distance ? distance : null,
        intensity,
        met,
        kcal_burned: kcal,
        note: null,
      });
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Aktivite eklendi."), queued ? "info" : "ok");
      setDistance(null);
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSteps() {
    if (stepsValue != null && (stepsValue < 0 || stepsValue > 200000)) return toast(t("Adım sayısı 0–200.000 arasında olmalı."), "error");
    try {
      await saveDaily(date, daily, { steps: stepsValue == null ? null : Math.round(stepsValue) });
      setStepsTouched(false);
      toast(t("Adım sayısı kaydedildi."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  return (
    <div>
      <PageHeader title={t("Spor ve aktivite")} />
      <DateNav date={date} onChange={(d) => { setStepsTouched(false); setDate(d); }} />

      <Card className="mb-4 grid grid-cols-3 gap-3">
        <Stat label={t("Alınan")} value={nf(s.intake.kcal)} unit="kcal" />
        <Stat label={t("Aktiviteyle yakılan")} value={nf(s.exercise_kcal)} unit="kcal" color="var(--burn)" />
        <Stat label={t("Adımlarla yakılan")} value={nf(s.steps_kcal)} unit="kcal" color="var(--burn)" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-sm font-semibold">{t("Aktivite ekle")}</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map((a) => (
              <Chip key={a.key} active={type === a.key} onClick={() => setType(a.key)}>
                {label(ACTIVITY_LABELS, a.key, lang)}
              </Chip>
            ))}
          </div>
          {type === "other" && (
            <Field label={t("Aktivite adı")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Süre (dakika)")}>
              <NumberInput value={duration} onChange={setDuration} min={1} max={1440} />
            </Field>
            {at.hasDistance && (
              <Field label={t("Mesafe (km)")} hint={t("İsteğe bağlı")}>
                <NumberInput value={distance} onChange={setDistance} min={0} max={500} step="0.1" />
              </Field>
            )}
          </div>
          <Field label={t("Yoğunluk")} hint={at.hasDistance && distance ? t("Mesafe girildiği için hız esas alınır.") : undefined}>
            <Segmented value={intensity} onChange={setIntensity} options={(["low", "moderate", "high"] as Intensity[]).map((i) => ({ value: i, label: label(INTENSITY_LABELS, i, lang) }))} />
          </Field>
          <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
            <span className="text-sm text-muted">
              {t("Tahmini yakılan")} <span className="text-xs">({nf(weight, 1)} kg · {nf(met, 1)} MET)</span>
            </span>
            <span className="flex items-center gap-1 text-lg font-bold text-burn">
              <Flame size={18} />
              {nf(kcal)} kcal
            </span>
          </div>
          <Button size="lg" className="w-full" loading={busy} onClick={save}>
            {t("Aktiviteyi kaydet")}
          </Button>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Footprints size={16} className="text-muted" />
              {t("Adım sayısı")}
            </p>
            <div className="flex gap-2">
              <NumberInput value={stepsValue} onChange={(v) => { setStepsTouched(true); setSteps(v); }} min={0} max={200000} placeholder="0" aria-label={t("Adım sayısı")} />
              <Button onClick={saveSteps} disabled={!stepsTouched} className="shrink-0">
                {t("Kaydet")}
              </Button>
            </div>
            <Bar value={s.steps} max={profile?.steps_target ?? 0} color="var(--burn)" />
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>
                {nf(s.steps)} / {nf(profile?.steps_target ?? 0)} {t("adım")}
              </span>
              <label className="flex items-center gap-2">
                {t("Günlük hedef")}
                <select
                  value={profile?.steps_target ?? 8000}
                  onChange={(e) => saveProfile({ steps_target: Number(e.target.value) }).catch(() => toast(t("Kaydedilemedi."), "error"))}
                  className="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-text"
                >
                  {[4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000].map((n) => (
                    <option key={n} value={n}>
                      {nf(n)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card className="p-0">
            <p className="px-4 py-3 text-sm font-semibold">{t("Günün aktiviteleri")}</p>
            {data.activities.length === 0 ? (
              <Empty icon={<ActivityIcon size={22} />} title={t("Bu gün için aktivite kaydı yok")} />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data.activities.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.name || label(ACTIVITY_LABELS, a.type, lang)}</p>
                      <p className="truncate text-xs text-muted">
                        {timeOf(a.started_at)} · {nf(a.duration_min)} {t("dk")}
                        {a.distance_km ? ` · ${nf(a.distance_km, 1)} km` : ""} · {label(INTENSITY_LABELS, a.intensity, lang)}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-burn">
                      <Flame size={14} />
                      {nf(a.kcal_burned)}
                    </span>
                    <button type="button" aria-label={t("Sil")} onClick={() => deleteRow("activities", a.id).catch(() => toast(t("Silinemedi."), "error"))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-danger">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
        {t("Çifte sayım önlenir: aktivitelerde yalnızca dinlenme harcamasının üzerindeki net enerji hesaplanır; yürüyüş ve koşu kayıtlarının adımları, adım sayınızdan düşülür. Günlük kalori hedefiniz genel hareketlilik seviyenizi zaten içerdiğinden, yakılan kaloriler varsayılan olarak bütçenize eklenmez (Profil › Hedefler bölümünden değiştirebilirsiniz).")}
      </p>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityInner />
    </Suspense>
  );
}
