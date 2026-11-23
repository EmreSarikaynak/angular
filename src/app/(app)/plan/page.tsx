"use client";
import { mealLabel } from "@/lib/bkn/ramadan";
import { useState } from "react";
import { CalendarDays, Check, Copy, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button, Card, Empty, Field, Input, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useMealPlans } from "@/lib/data/hooks";
import { upsertRow, uuid } from "@/lib/data/store";
import { addDays, formatDate, timestampFor, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import type { MealPlanData, PlanMeal } from "@/lib/types";

export default function PlanPage() {
  const { t, lang, profile, toast, online, config, refreshConfig } = useApp();
  const plans = useMealPlans();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"plan" | "shopping">("plan");
  const [day, setDay] = useState(1);

  const current = plans.data?.[0];
  const plan = current?.plan;
  const aiReady = online && config?.ai_available !== false;
  const today = toDateKey();
  const dayData = plan?.days.find((d) => d.day === day) ?? plan?.days[0];
  const total = (dayData?.meals ?? []).reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein_g }), { kcal: 0, protein: 0 });
  const allItems = (plan?.shopping ?? []).flatMap((c) => c.items);
  const checked = new Set(current?.checked ?? []);

  async function generate() {
    if (current && !confirm(t("Mevcut plan ve alışveriş listesi yenisiyle değiştirilsin mi?"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ result: MealPlanData }>("/api/ai/meal-plan", { body: { lang, note: note.trim() || undefined } });
      await upsertRow("meal_plans", { id: uuid(), entry_date: today, plan: res.result, checked: [] });
      void refreshConfig();
      setDay(1);
      setTab("plan");
      toast(t("Haftalık planınız hazır."));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      setError(code === "profile_incomplete" ? t("Plan için önce profilinizdeki hedefleri tamamlayın.") : errorText(code, t));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: string) {
    if (!current) return;
    const next = checked.has(item) ? [...checked].filter((x) => x !== item) : [...checked, item];
    await upsertRow("meal_plans", { id: current.id, entry_date: current.entry_date, plan: current.plan, checked: next }).catch(() => toast(t("Kaydedilemedi."), "error"));
  }

  async function addMeal(m: PlanMeal) {
    try {
      await upsertRow("food_entries", {
        id: uuid(), entry_date: today, consumed_at: timestampFor(today), meal: m.slot, name: m.name.slice(0, 200), quantity: 1, unit: t("porsiyon"), grams: null,
        kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, sugar_g: 0, fiber_g: 0, salt_g: 0, alcohol_g: 0,
        source: "manual", data_source: "ai", is_estimated: true, confidence: null, photo_path: null, group_id: null, group_name: null, drink_type: null, volume_ml: null, abv: null, note: null,
      });
      toast(t("Günlüğe eklendi."));
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  async function copyList() {
    const text = (plan?.shopping ?? []).map((c) => `${c.category}\n${c.items.map((i) => `${checked.has(i) ? "✓" : "•"} ${i}`).join("\n")}`).join("\n\n");
    try {
      if (navigator.share) await navigator.share({ title: t("Alışveriş listesi"), text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t("Liste panoya kopyalandı."));
      }
    } catch {
      /* kullanıcı paylaşımı iptal etti */
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("Haftalık öğün planı")} subtitle={t("Hedeflerinize ve tercihlerinize göre 7 gün")} />

      <Card className="mb-4 space-y-3">
        <Field label={t("Bu hafta için isteğiniz (isteğe bağlı)")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("Örn. akşamları hafif olsun, haftada 2 gün balık")} />
        </Field>
        <Button className="w-full" size="lg" loading={busy} disabled={!aiReady} onClick={generate}>
          <Sparkles size={18} />
          {current ? t("Yeni plan oluştur") : t("Plan oluştur")}
        </Button>
        {busy && <p className="text-center text-xs text-muted">{t("Plan hazırlanıyor; bu işlem yarım dakika kadar sürebilir.")}</p>}
        {!aiReady && <p className="text-xs text-warn">{t("Plan oluşturmak için bağlantı ve yapay zekâ servisi gerekir.")}</p>}
        {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">
          {t("Günlük hedef: {k} kcal · protein {p} g. Alerjileriniz ve beslenme tercihleriniz dikkate alınır.", { k: profile?.kcal_target ?? "–", p: profile?.protein_target_g ?? "–" })}
        </p>
      </Card>

      {plans.loading && !plans.data ? (
        <Skeleton className="h-64" />
      ) : !plan || !current ? (
        <Card>
          <Empty icon={<CalendarDays size={22} />} title={t("Henüz planınız yok")} text={t("Tek dokunuşla 7 günlük öğün planı ve alışveriş listesi oluşturun.")} />
        </Card>
      ) : (
        <>
          <Segmented className="mb-3" value={tab} onChange={setTab} options={[{ value: "plan", label: t("Plan") }, { value: "shopping", label: `${t("Alışveriş listesi")} (${allItems.filter((i) => checked.has(i)).length}/${allItems.length})` }]} />
          {tab === "plan" && dayData ? (
            <>
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {plan.days.map((d) => (
                  <button
                    key={d.day}
                    type="button"
                    aria-pressed={day === d.day}
                    onClick={() => setDay(d.day)}
                    className={cx("shrink-0 rounded-xl border px-3 py-2 text-center text-xs font-medium", day === d.day ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted")}
                  >
                    <span className="block">{t("{n}. gün", { n: d.day })}</span>
                    <span className="block text-[10px] font-normal">{formatDate(addDays(current.entry_date, d.day - 1), lang, { weekday: "short", day: "numeric" })}</span>
                  </button>
                ))}
              </div>
              <Card className="p-0">
                <p className="flex items-baseline justify-between px-4 py-3 text-sm">
                  <span className="font-semibold">{t("{n}. gün", { n: dayData.day })}</span>
                  <span className="text-muted">
                    {total.kcal} kcal · {t("protein")} {total.protein} g
                  </span>
                </p>
                <ul className="divide-y divide-border border-t border-border">
                  {dayData.meals.map((m, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-primary">{mealLabel(m.slot, lang, profile?.ramadan_mode)}</p>
                        <p className="text-sm">{m.name}</p>
                        <p className="text-xs text-muted">
                          {m.kcal} kcal · P {m.protein_g} · K {m.carbs_g} · Y {m.fat_g} g
                        </p>
                      </div>
                      <button type="button" aria-label={t("{name}: günlüğe ekle", { name: m.name })} onClick={() => addMeal(m)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                        <Plus size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          ) : (
            <div className="space-y-3">
              {plan.shopping.map((c) => (
                <Card key={c.category} className="p-0">
                  <p className="flex items-center gap-2 px-4 py-3 text-sm font-semibold">
                    <ShoppingCart size={15} className="text-muted" />
                    {c.category}
                  </p>
                  <ul className="divide-y divide-border border-t border-border">
                    {c.items.map((item) => (
                      <li key={item}>
                        <button type="button" role="checkbox" aria-checked={checked.has(item)} onClick={() => toggle(item)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                          <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-md border-2", checked.has(item) ? "border-primary bg-primary text-white" : "border-border text-transparent")}>
                            <Check size={14} />
                          </span>
                          <span className={cx("text-sm", checked.has(item) && "text-muted line-through")}>{item}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              <Button variant="secondary" className="w-full" onClick={copyList}>
                <Copy size={16} />
                {t("Listeyi paylaş / kopyala")}
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">{t("Plan ve besin değerleri yapay zekâ tahminidir; bilgilendirme amaçlıdır, tıbbi tavsiye ya da diyet reçetesi değildir.")}</p>
        </>
      )}
    </div>
  );
}
