"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CheckCircle2, Clock, Droplets, Footprints, Moon, Plus, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Bar, Button, Card, Chip, PageHeader, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { insightText } from "@/lib/bkn/messages";
import { proteinGap, trendInsights, type Insight } from "@/lib/bkn/insights";
import { pickRecipes, type Recipe, type RecipeTag } from "@/lib/bkn/recipes";
import { useRange } from "@/lib/data/hooks";
import { upsertRow, uuid } from "@/lib/data/store";
import { summarizeDay } from "@/lib/day";
import { addDays, defaultMeal, timestampFor, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { dayRows } from "@/lib/stats";

interface Card_ {
  key: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  minutes: number;
  ingredients: string[];
  steps: string;
  why?: string;
  ai?: boolean;
}

export default function CoachPage() {
  const { t, lang, profile, toast, online, config, refreshConfig } = useApp();
  const today = toDateKey();
  const range = useRange(addDays(today, -3), today);
  const [focus, setFocus] = useState<RecipeTag | null>(null);
  const [ai, setAi] = useState<Record<string, Card_[]>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const model = useMemo(() => {
    const data = range.data ?? { food: [], water: [], activities: [], daily: [], rings: [] };
    const s = summarizeDay(today, data, profile);
    const insights = trendInsights(dayRows(addDays(today, -3), addDays(today, -1), data, profile), profile);
    const gap = proteinGap(s.intake.protein_g, profile?.protein_target_g, new Date().getHours());
    return { s, insights, gap, hasToday: data.food.some((f) => f.entry_date === today) };
  }, [range.data, today, profile]);

  const { s, insights, gap } = model;
  const suggested: RecipeTag = gap.remaining > 15 ? "high_protein" : (insights.find((i) => i.recipeTag)?.recipeTag ?? "high_protein");
  const tag = focus ?? suggested;
  const remainingKcal = Math.max(0, s.remaining_kcal);
  const library: Card_[] = pickRecipes(tag, { allergies: profile?.allergies, diets: profile?.diet_preferences, maxKcal: remainingKcal > 150 ? remainingKcal : undefined, limit: 4 }).map((r: Recipe) => ({
    key: r.id,
    name: r.name[lang],
    kcal: r.kcal,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
    minutes: r.minutes,
    ingredients: r.ingredients[lang],
    steps: r.steps[lang],
  }));
  const cards = [...(ai[tag] ?? []), ...library];
  const aiReady = online && config?.ai_available !== false;

  const TAGS: { key: RecipeTag; label: string }[] = [
    { key: "high_protein", label: t("Yüksek protein") },
    { key: "low_cal", label: t("Hafif") },
    { key: "low_sugar", label: t("Az şekerli") },
    { key: "low_salt", label: t("Az tuzlu") },
    { key: "low_fat", label: t("Az yağlı") },
    { key: "high_fiber", label: t("Lifli") },
  ];

  async function askAi() {
    setAiBusy(true);
    setError(null);
    try {
      const res = await api<{ result: { recipes: Omit<Card_, "key" | "ai">[] } }>("/api/ai/recipes", { body: { focus: tag === "quick" ? "high_protein" : tag, remaining_kcal: Math.round(remainingKcal), remaining_protein_g: gap.remaining, lang } });
      setAi((cur) => ({ ...cur, [tag]: res.result.recipes.map((r, i) => ({ ...r, key: `ai-${tag}-${i}`, ai: true })) }));
      void refreshConfig();
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "", t));
    } finally {
      setAiBusy(false);
    }
  }

  async function addToDiary(r: Card_) {
    try {
      await upsertRow("food_entries", {
        id: uuid(), entry_date: today, consumed_at: timestampFor(today), meal: defaultMeal(), name: r.name.slice(0, 200), quantity: 1, unit: t("porsiyon"), grams: null,
        kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0,
        source: "manual", data_source: "ai", is_estimated: true, confidence: null, photo_path: null, group_id: null, group_name: null, drink_type: null, volume_ml: null, abv: null, note: null,
      });
      toast(t("Günlüğe eklendi."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  const insightIcon = (i: Insight) => (i.key === "water_low" ? <Droplets size={18} /> : i.key === "steps_low" ? <Footprints size={18} /> : i.key === "sleep_low" ? <Moon size={18} /> : i.direction === "over" ? <ArrowUp size={18} /> : <ArrowDown size={18} />);
  const action = (i: Insight) =>
    i.key === "water_low" ? (
      <Link href="/water" className="text-sm font-semibold text-primary">{t("Su ekle")}</Link>
    ) : i.key === "steps_low" || i.key === "kcal_high" ? (
      <Link href="/activity" className="text-sm font-semibold text-primary">{t("Aktivite ekle")}</Link>
    ) : i.key === "sleep_low" ? (
      <Link href="/wellbeing" className="text-sm font-semibold text-primary">{t("Uyku kaydı")}</Link>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t("Öneriler")} subtitle={t("Kayıtlarınıza göre bugün ve son günler")} />

      {range.loading && !range.data ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <Card>
            <h2 className="font-semibold">{t("Bugünkü protein")}</h2>
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="text-muted">
                {Math.round(s.intake.protein_g)} / {profile?.protein_target_g ?? "–"} g
              </span>
              <span className={`font-semibold ${gap.remaining === 0 ? "text-primary" : ""}`}>{gap.remaining === 0 ? t("Hedef tamamlandı") : t("{n} g kaldı", { n: gap.remaining })}</span>
            </div>
            <Bar value={s.intake.protein_g} max={profile?.protein_target_g ?? 0} color="var(--protein)" className="mt-2" />
            {gap.remaining > 0 && (
              <p className="mt-3 text-sm text-muted">
                {gap.behind ? t("Günün bu saatine göre geridesiniz. Aşağıdaki proteinli tariflerden biri açığı kapatmanıza yardımcı olabilir.") : t("Yolundasınız. Kalan {n} g için aşağıdaki fikirlere göz atabilirsiniz.", { n: gap.remaining })}
              </p>
            )}
            <p className="mt-2 text-xs text-muted">{t("Bugün kalan kalori: {n} kcal", { n: Math.round(s.remaining_kcal) })}</p>
          </Card>

          <Card>
            <h2 className="font-semibold">{t("Son 3 günün eğilimi")}</h2>
            {insights.length === 0 ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <CheckCircle2 size={18} className="shrink-0 text-primary" />
                {t("Belirgin bir sapma görünmüyor ya da henüz yeterli kayıt yok. En az 2 gün kayıt girdiğinizde eğilimler burada görünür.")}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {insights.map((i) => {
                  const text = insightText(lang, i);
                  return (
                    <li key={i.key} className="flex gap-3 rounded-xl bg-surface-2 p-3">
                      <span className={`mt-0.5 shrink-0 ${i.direction === "over" ? "text-warn" : "text-water"}`}>{insightIcon(i)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{text.title}</p>
                        <p className="text-sm text-muted">{text.body}</p>
                        <div className="mt-1.5 flex gap-4">
                          {i.recipeTag && (
                            <button type="button" onClick={() => setFocus(i.recipeTag!)} className="text-sm font-semibold text-primary">
                              {t("Uygun tarifleri göster")}
                            </button>
                          )}
                          {action(i)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div>
            <h2 className="mb-2 font-semibold">{t("Tarifler")}</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {TAGS.map((x) => (
                <Chip key={x.key} active={tag === x.key} onClick={() => setFocus(x.key)}>
                  {x.label}
                </Chip>
              ))}
            </div>
            {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((r) => (
                <Card key={r.key} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{r.name}</p>
                    {r.ai && <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">{t("Size özel")}</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {r.kcal} kcal · P {r.protein_g} · K {r.carbs_g} · Y {r.fat_g} g
                    <span className="ml-2 inline-flex items-center gap-0.5">
                      <Clock size={11} />
                      {r.minutes} {t("dk")}
                    </span>
                  </p>
                  {r.why && <p className="mt-1.5 text-xs text-primary">{r.why}</p>}
                  {open === r.key && (
                    <div className="mt-2 text-sm">
                      <ul className="list-disc space-y-0.5 pl-5 text-muted">
                        {r.ingredients.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      <p className="mt-2">{r.steps}</p>
                    </div>
                  )}
                  <div className="mt-auto flex gap-2 pt-3">
                    <Button variant="secondary" size="sm" className="flex-1" aria-expanded={open === r.key} onClick={() => setOpen(open === r.key ? null : r.key)}>
                      {open === r.key ? t("Gizle") : t("Tarifi gör")}
                    </Button>
                    <Button size="sm" onClick={() => addToDiary(r)}>
                      <Plus size={15} />
                      {t("Günlüğe ekle")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            {cards.length === 0 && <p className="text-sm text-muted">{t("Alerji ve tercihlerinize uyan hazır tarif bulunamadı. Size özel tarif isteyebilirsiniz.")}</p>}
            <Button variant="secondary" className="mt-3 w-full" loading={aiBusy} disabled={!aiReady} onClick={askAi}>
              <Sparkles size={16} />
              {t("Yapay zekâdan bana özel tarif iste")}
            </Button>
            <p className="mt-2 text-xs text-muted">{t("Besin değerleri bir porsiyon için yaklaşık değerlerdir. Öneriler bilgilendirme amaçlıdır; tıbbi tavsiye değildir.")}</p>
          </div>
        </>
      )}
    </div>
  );
}
