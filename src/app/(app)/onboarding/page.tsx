"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { Button, Card, Chip, Field, Input, NumberInput, Select } from "@/components/ui";
import { ACTIVITY_LEVEL_LABELS, ALLERGY_OPTIONS, DIET_OPTIONS, GOAL_LABELS, label } from "@/lib/i18n/labels";
import { bmi, calculateTargets } from "@/lib/nutrition/calc";
import { ageFrom, toDateKey } from "@/lib/dates";
import { upsertRow, uuid } from "@/lib/data/store";
import type { ActivityLevel, Goal, Sex } from "@/lib/types";

export default function OnboardingPage() {
  const { t, lang, profile, saveProfile, toast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [birth, setBirth] = useState(profile?.birth_date ?? "");
  const [sex, setSex] = useState<Sex | "">(profile?.sex ?? "");
  const [height, setHeight] = useState<number | null>(profile?.height_cm ?? null);
  const [weight, setWeight] = useState<number | null>(profile?.weight_kg ?? null);
  const [target, setTarget] = useState<number | null>(profile?.target_weight_kg ?? null);
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? "lose");
  const [rate, setRate] = useState<number>(profile?.weekly_rate_kg ?? 0.5);
  const [level, setLevel] = useState<ActivityLevel>(profile?.activity_level ?? "light");
  const [allergies, setAllergies] = useState<string[]>(profile?.allergies ?? []);
  const [diets, setDiets] = useState<string[]>(profile?.diet_preferences ?? []);
  const [otherAllergy, setOtherAllergy] = useState("");

  const age = birth ? ageFrom(birth) : null;
  const errors = useMemo(() => {
    const e: string[] = [];
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim()) e.push(t("Ad ve soyad gerekli."));
      if (!birth || age == null || age < 13 || age > 110) e.push(t("Geçerli bir doğum tarihi girin (13 yaş ve üzeri)."));
      if (!sex) e.push(t("Cinsiyet seçin."));
      if (!height || height < 100 || height > 250) e.push(t("Boy 100–250 cm arasında olmalı."));
      if (!weight || weight < 30 || weight > 300) e.push(t("Kilo 30–300 kg arasında olmalı."));
    }
    if (step === 1) {
      if (!target || target < 30 || target > 300) e.push(t("Hedef kilo 30–300 kg arasında olmalı."));
      else if (weight && goal === "lose" && target >= weight) e.push(t("Kilo vermek için hedef kilo mevcut kilodan düşük olmalı."));
      else if (weight && goal === "gain" && target <= weight) e.push(t("Kilo almak için hedef kilo mevcut kilodan yüksek olmalı."));
    }
    return e;
  }, [step, firstName, lastName, birth, age, sex, height, weight, target, goal, t]);

  const targets = useMemo(() => {
    if (!sex || !height || !weight || age == null) return null;
    return calculateTargets({ sex, age, height_cm: height, weight_kg: weight, activity_level: level, goal, weekly_rate_kg: rate });
  }, [sex, age, height, weight, level, goal, rate]);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) => set(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);

  async function finish() {
    if (!targets || !sex || !height || !weight || !target) return;
    setBusy(true);
    try {
      const extra = otherAllergy
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);
      await saveProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birth,
        sex,
        height_cm: height,
        weight_kg: weight,
        start_weight_kg: weight,
        target_weight_kg: goal === "maintain" ? weight : target,
        goal,
        weekly_rate_kg: goal === "maintain" ? 0 : rate,
        activity_level: level,
        allergies: [...allergies, ...extra],
        diet_preferences: diets,
        kcal_target: targets.kcal_target,
        protein_target_g: targets.protein_target_g,
        carbs_target_g: targets.carbs_target_g,
        fat_target_g: targets.fat_target_g,
        water_target_ml: targets.water_target_ml,
        targets_custom: false,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul",
        language: lang,
        onboarded_at: new Date().toISOString(),
      });
      await upsertRow("body_measurements", {
        id: uuid(),
        entry_date: toDateKey(),
        weight_kg: weight,
        waist_cm: null,
        hip_cm: null,
        chest_cm: null,
        body_fat_pct: null,
        bmi: bmi(weight, height),
        note: null,
      });
      router.replace("/");
    } catch {
      toast(t("Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">{t("Adım {a} / {b}", { a: step + 1, b: 3 })}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{[t("Sizi tanıyalım"), t("Hedefiniz"), t("Beslenme tercihleri")][step]}</h1>
        <p className="mt-1 text-sm text-muted">
          {[t("Günlük kalori ve besin hedeflerinizi hesaplamak için bu bilgilere ihtiyacımız var."), t("Hedefinize uygun günlük enerji ihtiyacını belirleyelim."), t("Öneriler alerji ve tercihlerinize göre uyarlanır.")][step]}
        </p>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-surface-2"}`} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Ad")}>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} autoComplete="given-name" />
            </Field>
            <Field label={t("Soyad")}>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} autoComplete="family-name" />
            </Field>
          </div>
          <Field label={t("Doğum tarihi")}>
            <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} max={toDateKey()} />
          </Field>
          <Field label={t("Cinsiyet")} hint={t("Bazal metabolizma hesabında kullanılır.")}>
            <div className="flex gap-2">
              <Chip active={sex === "female"} onClick={() => setSex("female")} className="flex-1">
                {t("Kadın")}
              </Chip>
              <Chip active={sex === "male"} onClick={() => setSex("male")} className="flex-1">
                {t("Erkek")}
              </Chip>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Boy (cm)")}>
              <NumberInput value={height} onChange={setHeight} min={100} max={250} />
            </Field>
            <Field label={t("Kilo (kg)")}>
              <NumberInput value={weight} onChange={setWeight} min={30} max={300} step="0.1" />
            </Field>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-3">
          <Field label={t("Hedef")}>
            <div className="flex flex-col gap-2">
              {(["lose", "maintain", "gain"] as Goal[]).map((g) => (
                <Chip
                  key={g}
                  active={goal === g}
                  onClick={() => {
                    setGoal(g);
                    if (g === "maintain" && weight) setTarget(weight);
                  }}
                  className="rounded-xl py-2.5 text-left"
                >
                  {label(GOAL_LABELS, g, lang)}
                </Chip>
              ))}
            </div>
          </Field>
          {goal !== "maintain" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Hedef kilo (kg)")}>
                <NumberInput value={target} onChange={setTarget} min={30} max={300} step="0.1" />
              </Field>
              <Field label={t("Haftalık hız")}>
                <Select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                  <option value={0.25}>0,25 kg</option>
                  <option value={0.5}>0,5 kg</option>
                  <option value={0.75}>0,75 kg</option>
                  <option value={1}>1 kg</option>
                </Select>
              </Field>
            </div>
          )}
          <Field label={t("Günlük hareketlilik seviyesi")}>
            <Select value={level} onChange={(e) => setLevel(e.target.value as ActivityLevel)}>
              {Object.keys(ACTIVITY_LEVEL_LABELS).map((k) => (
                <option key={k} value={k}>
                  {label(ACTIVITY_LEVEL_LABELS, k, lang)}
                </option>
              ))}
            </Select>
          </Field>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="space-y-3">
            <Field label={t("Besin alerjileri (varsa)")}>
              <div className="flex flex-wrap gap-2">
                {Object.keys(ALLERGY_OPTIONS).map((k) => (
                  <Chip key={k} active={allergies.includes(k)} onClick={() => toggle(allergies, setAllergies, k)}>
                    {label(ALLERGY_OPTIONS, k, lang)}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t("Diğer alerjiler")} hint={t("Virgülle ayırarak yazın.")}>
              <Input value={otherAllergy} onChange={(e) => setOtherAllergy(e.target.value)} maxLength={200} />
            </Field>
            <Field label={t("Beslenme tercihleri")}>
              <div className="flex flex-wrap gap-2">
                {Object.keys(DIET_OPTIONS).map((k) => (
                  <Chip key={k} active={diets.includes(k)} onClick={() => toggle(diets, setDiets, k)}>
                    {label(DIET_OPTIONS, k, lang)}
                  </Chip>
                ))}
              </div>
            </Field>
          </Card>
          {targets && (
            <Card>
              <p className="text-sm font-semibold">{t("Günlük hedefleriniz")}</p>
              <p className="mt-1 text-xs text-muted">{t("Mifflin-St Jeor denklemiyle tahmin edilmiştir. Profil sayfasından dilediğiniz zaman değiştirebilirsiniz.")}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[
                  [t("Kalori"), `${targets.kcal_target}`, "kcal"],
                  [t("Protein"), `${targets.protein_target_g}`, "g"],
                  [t("Karbonhidrat"), `${targets.carbs_target_g}`, "g"],
                  [t("Yağ"), `${targets.fat_target_g}`, "g"],
                  [t("Su"), `${targets.water_target_ml}`, "ml"],
                  [t("Günlük harcama"), `${targets.tdee}`, "kcal"],
                ].map(([l, v, u]) => (
                  <div key={l} className="rounded-xl bg-surface-2 p-2.5">
                    <p className="text-[11px] text-muted">{l}</p>
                    <p className="font-semibold">
                      {v} <span className="text-xs font-normal text-muted">{u}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {attempted && errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-danger" role="alert">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)} className="flex-1">
            {t("Geri")}
          </Button>
        )}
        {step < 2 ? (
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              if (errors.length > 0) return setAttempted(true);
              setAttempted(false);
              setStep(step + 1);
            }}
          >
            {t("Devam")}
          </Button>
        ) : (
          <Button size="lg" className="flex-1" loading={busy} onClick={finish}>
            {t("Başla")}
          </Button>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">{t("Bu uygulama tıbbi tavsiye vermez. Sağlık sorununuz varsa hekiminize danışın.")}</p>
    </div>
  );
}
