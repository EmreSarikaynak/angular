"use client";
import { useState } from "react";
import { ChefHat, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ItemFields, blankItem } from "@/components/item-fields";
import { Button, Card, Chip, Empty, Field, Input, NumberInput, PageHeader, Sheet, Skeleton, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { mealLabel } from "@/lib/bkn/ramadan";
import { useUserRecipes } from "@/lib/data/hooks";
import { deleteRow, upsertRow, uuid } from "@/lib/data/store";
import { defaultMeal, timestampFor, toDateKey } from "@/lib/dates";
import { errorText } from "@/lib/errors";
import { scaleNutrients, sumNutrients } from "@/lib/nutrition/calc";
import { scaleMicros, sumMicros } from "@/lib/nutrition/micros";
import type { AnalysisResult, FoodItem, Meal, UserRecipe } from "@/lib/types";
import { MEALS } from "@/lib/types";

const blank = (): UserRecipe => ({ id: uuid(), name: "", servings: 4, ingredients: [], note: "", use_count: 0 });

/** Tarifin bir porsiyonunun besin değerleri. */
function perServing(r: Pick<UserRecipe, "ingredients" | "servings">) {
  return scaleNutrients(sumNutrients(r.ingredients), 1 / Math.max(0.5, r.servings));
}

export default function RecipesPage() {
  const { t, lang, profile, toast, online, config, refreshConfig } = useApp();
  const recipes = useUserRecipes();
  const [editing, setEditing] = useState<UserRecipe | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"ai" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<UserRecipe | null>(null);
  const [portions, setPortions] = useState<number | null>(1);
  const [meal, setMeal] = useState<Meal>(defaultMeal());

  const list = recipes.data ?? [];
  const aiReady = online && config?.ai_available !== false;
  const isExisting = !!editing && list.some((r) => r.id === editing.id);

  async function analyze() {
    if (!editing || !text.trim()) return;
    setBusy("ai");
    setError(null);
    try {
      const res = await api<{ result: AnalysisResult }>("/api/ai/analyze", { body: { kind: "text", lang, text: text.trim(), hint: lang === "en" ? "This is the full ingredient list of a home recipe; give the TOTAL amounts as written, not per serving." : "Bu bir ev tarifinin tüm malzeme listesidir; porsiyon başına değil, yazılan TOPLAM miktarları hesapla." } });
      void refreshConfig();
      if (!res.result.is_food || !res.result.items.length) return setError(t("Malzeme bulunamadı. Miktarlarıyla birlikte yazmayı deneyin."));
      setEditing({ ...editing, ingredients: [...editing.ingredients, ...res.result.items] });
      setText("");
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "", t));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!editing) return;
    const ingredients = editing.ingredients.filter((i) => i.name.trim());
    if (!editing.name.trim()) return toast(t("Tarif adını girin."), "error");
    if (!ingredients.length) return toast(t("En az bir malzeme ekleyin."), "error");
    if (!editing.servings || editing.servings < 0.5) return toast(t("Porsiyon sayısı en az 0,5 olmalı."), "error");
    setBusy("save");
    try {
      await upsertRow("user_recipes", { id: editing.id, name: editing.name.trim().slice(0, 160), servings: editing.servings, ingredients, note: editing.note?.trim().slice(0, 1000) || null, use_count: editing.use_count ?? 0 });
      toast(t("Tarif kaydedildi."));
      setEditing(null);
    } catch {
      toast(t("Kaydedilemedi."), "error");
    } finally {
      setBusy(null);
    }
  }

  async function addToDiary() {
    if (!adding || !portions || portions <= 0) return;
    const factor = portions / Math.max(0.5, adding.servings);
    const total = scaleNutrients(sumNutrients(adding.ingredients), factor);
    const grams = adding.ingredients.reduce((s, i) => s + (i.grams ?? 0), 0) * factor;
    const today = toDateKey();
    try {
      await upsertRow("food_entries", {
        id: uuid(), entry_date: today, consumed_at: timestampFor(today), meal, name: adding.name, quantity: portions, unit: t("porsiyon"), grams: grams ? Math.round(grams) : null,
        ...total, kcal: Math.round(total.kcal), micros: scaleMicros(sumMicros(adding.ingredients.map((i) => i.micros)), factor),
        source: "favorite", data_source: adding.ingredients.every((i) => i.data_source === "reference") ? "reference" : "ai", is_estimated: true, confidence: null,
        photo_path: null, group_id: null, group_name: null, drink_type: null, volume_ml: null, abv: null, note: null,
      });
      void upsertRow("user_recipes", { id: adding.id, name: adding.name, servings: adding.servings, ingredients: adding.ingredients, note: adding.note, use_count: (adding.use_count ?? 0) + 1 }).catch(() => {});
      toast(t("Günlüğe eklendi."));
      setAdding(null);
    } catch {
      toast(t("Kaydedilemedi."), "error");
    }
  }

  const total = editing ? sumNutrients(editing.ingredients) : null;
  const one = editing && total ? scaleNutrients(total, 1 / Math.max(0.5, editing.servings || 1)) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("Tariflerim")}
        subtitle={t("Ev yemeğinizi bir kez girin, her seferinde tek dokunuşla ekleyin")}
        action={
          <Button size="sm" onClick={() => { setEditing(blank()); setText(""); setError(null); }}>
            <Plus size={16} />
            {t("Yeni tarif")}
          </Button>
        }
      />
      {recipes.loading && !recipes.data ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <Card>
          <Empty icon={<ChefHat size={22} />} title={t("Henüz tarifiniz yok")} text={t("Malzemeleri yazın, toplam besin değeri hesaplansın; porsiyon başına değerler otomatik çıkar.")} />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const n = perServing(r);
            return (
              <Card key={r.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    {t("1 porsiyon")}: {Math.round(n.kcal)} kcal · P {Math.round(n.protein_g)} · K {Math.round(n.carbs_g)} · Y {Math.round(n.fat_g)} g · {t("{n} porsiyonluk", { n: r.servings })}
                  </p>
                </div>
                <button type="button" aria-label={t("Düzenle")} onClick={() => { setEditing({ ...r, note: r.note ?? "" }); setText(""); setError(null); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2">
                  <Pencil size={16} />
                </button>
                <Button size="sm" onClick={() => { setAdding(r); setPortions(1); setMeal(defaultMeal()); }}>
                  <Plus size={15} />
                  {t("Ekle")}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={isExisting ? t("Tarifi düzenle") : t("Yeni tarif")}>
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("Tarif adı")} className="col-span-2">
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={160} placeholder={t("Örn. Annemin kuru fasulyesi")} />
              </Field>
              <Field label={t("Kaç porsiyon?")}>
                <NumberInput value={editing.servings} onChange={(v) => setEditing({ ...editing, servings: v ?? 1 })} min={0.5} max={100} step="0.5" />
              </Field>
            </div>
            <Field label={t("Malzemeler")} hint={t("Tüm tarifin malzemelerini miktarlarıyla yazın; yapay zekâ kalemlere ayırıp hesaplar.")}>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t("Örn. 500 g kuru fasulye, 300 g kuşbaşı et, 2 yemek kaşığı tereyağı, 1 soğan, 2 yemek kaşığı salça")} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" loading={busy === "ai"} disabled={!text.trim() || !aiReady} onClick={analyze}>
                <Sparkles size={16} />
                {t("Malzemeleri hesapla")}
              </Button>
              <Button variant="secondary" onClick={() => setEditing({ ...editing, ingredients: [...editing.ingredients, blankItem()] })}>
                <Plus size={16} />
                {t("Elle ekle")}
              </Button>
            </div>
            {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            {editing.ingredients.map((it, idx) => (
              <ItemFields key={idx} item={it} onChange={(next: FoodItem) => setEditing({ ...editing, ingredients: editing.ingredients.map((x, i) => (i === idx ? next : x)) })} onRemove={() => setEditing({ ...editing, ingredients: editing.ingredients.filter((_, i) => i !== idx) })} />
            ))}
            {total && one && editing.ingredients.length > 0 && (
              <div className="rounded-xl bg-surface-2 p-3 text-sm">
                <p>
                  <span className="text-muted">{t("Toplam")}:</span> <b>{Math.round(total.kcal)} kcal</b> · P {Math.round(total.protein_g)} · K {Math.round(total.carbs_g)} · Y {Math.round(total.fat_g)} g
                </p>
                <p className="mt-0.5">
                  <span className="text-muted">{t("1 porsiyon")}:</span> <b className="text-primary">{Math.round(one.kcal)} kcal</b> · P {Math.round(one.protein_g)} · K {Math.round(one.carbs_g)} · Y {Math.round(one.fat_g)} g
                </p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {isExisting && (
                <Button variant="secondary" aria-label={t("Sil")} onClick={async () => { if (!confirm(t("“{name}” silinsin mi?", { name: editing.name }))) return; await deleteRow("user_recipes", editing.id).catch(() => toast(t("Silinemedi."), "error")); setEditing(null); }}>
                  <Trash2 size={16} />
                </Button>
              )}
              <Button className="flex-1" size="lg" loading={busy === "save"} onClick={save}>
                {t("Tarifi kaydet")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding?.name ?? ""}>
        {adding && (
          <div className="space-y-3">
            <Field label={t("Kaç porsiyon yediniz?")}>
              <NumberInput value={portions} onChange={setPortions} min={0.25} max={20} step="0.25" />
            </Field>
            <p className="text-sm text-muted">
              {Math.round(perServing(adding).kcal * (portions ?? 0))} kcal · P {Math.round(perServing(adding).protein_g * (portions ?? 0))} g
            </p>
            <Field label={t("Öğün")}>
              <div className="flex flex-wrap gap-2">
                {MEALS.filter((m) => m !== "drink").map((m) => (
                  <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
                    {mealLabel(m, lang, profile?.ramadan_mode)}
                  </Chip>
                ))}
              </div>
            </Field>
            <Button size="lg" className="w-full" disabled={!portions || portions <= 0} onClick={addToDiary}>
              {t("Günlüğe ekle")}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
