"use client";
import { mealLabel, ramadanDefaultMeal } from "@/lib/bkn/ramadan";
import { useState } from "react";
import { HelpCircle, Plus } from "lucide-react";
import { useApp } from "./app-provider";
import { Button, Card, Chip, Field, Input } from "./ui";
import { ItemFields, blankItem } from "./item-fields";
import { ProductNotes } from "./product-notes";
import { sumNutrients } from "@/lib/nutrition/calc";
import { defaultMeal, timeOf, timestampFor, toDateKey } from "@/lib/dates";
import { upsertRow, upsertRows, uuid } from "@/lib/data/store";
import { supabase } from "@/lib/supabase/client";
import type { CompressedImage } from "@/lib/image";
import type { AnalysisResult, EntrySource, FoodEntry, FoodItem, Meal } from "@/lib/types";
import { MEALS } from "@/lib/types";

export interface ReviewProps {
  source: EntrySource;
  initial: { name: string; items: FoodItem[] };
  analysis?: AnalysisResult | null;
  image?: CompressedImage | null;
  date: string;
  meal?: Meal;
  /** Güven düşükse kullanıcı porsiyon bilgisini yazıp yeniden hesaplatabilir. */
  onClarify?: (hint: string) => Promise<void>;
  onSaved: (date: string) => void;
  onCancel: () => void;
}

function per100Of(i: FoodItem) {
  const k = 100 / (i.grams ?? 100);
  return { kcal: i.kcal * k, protein_g: i.protein_g * k, fat_g: i.fat_g * k, sat_fat_g: null, sugar_g: i.sugar_g * k, fiber_g: i.fiber_g * k, salt_g: i.salt_g * k };
}

/** Analiz sonucunu (ya da elle girilen kaydı) düzenleme ve onaylama ekranı. */
export function Review({ source, initial, analysis, image, date: initialDate, meal: initialMeal, onClarify, onSaved, onCancel }: ReviewProps) {
  const { t, lang, profile, toast, online } = useApp();
  const [items, setItems] = useState<FoodItem[]>(initial.items.length ? initial.items : [blankItem()]);
  const [meal, setMeal] = useState<Meal>(() => {
    if (initialMeal) return initialMeal;
    const now = new Date();
    return profile?.ramadan_mode ? ramadanDefaultMeal(now.getHours() * 60 + now.getMinutes(), profile.iftar_time, profile.sahur_time) : defaultMeal();
  });
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(timeOf(new Date().toISOString()));
  const [favorite, setFavorite] = useState(false);
  const [favName, setFavName] = useState(initial.name);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [clarifying, setClarifying] = useState(false);

  const total = sumNutrients(items);
  const valid = items.length > 0 && items.every((i) => i.name.trim().length > 0 && isFinite(i.kcal));

  async function save() {
    if (!valid) return toast(t("Her kalem için bir ad girin."), "error");
    setBusy(true);
    try {
      let photoPath: string | null = null;
      if (image && source === "photo" && profile?.store_photos && online) {
        const { data: s } = await supabase().auth.getSession();
        const path = `${s.session?.user.id}/${uuid()}.jpg`;
        const up = await supabase().storage.from("meal-photos").upload(path, image.blob, { contentType: "image/jpeg", upsert: false });
        if (!up.error) photoPath = path;
      }
      const groupId = items.length > 1 ? uuid() : null;
      const consumedAt = timestampFor(date, time);
      const rows: FoodEntry[] = items.map((i) => ({
        id: uuid(),
        entry_date: date,
        consumed_at: consumedAt,
        meal,
        name: i.name.trim().slice(0, 200),
        quantity: i.quantity,
        unit: i.unit,
        grams: i.grams,
        kcal: Math.round(i.kcal),
        protein_g: i.protein_g,
        carbs_g: i.carbs_g,
        fat_g: i.fat_g,
        sugar_g: i.sugar_g,
        fiber_g: i.fiber_g,
        salt_g: i.salt_g,
        alcohol_g: i.alcohol_g,
        micros: i.micros ?? null,
        source,
        data_source: i.data_source,
        is_estimated: i.is_estimated,
        confidence: i.confidence,
        photo_path: photoPath,
        group_id: groupId,
        group_name: groupId ? (initial.name || null) : null,
        drink_type: null,
        volume_ml: null,
        abv: null,
        note: null,
      }));
      const { queued } = await upsertRows("food_entries", rows);
      if (favorite) {
        await upsertRow("favorites", { id: uuid(), name: (favName.trim() || items[0].name).slice(0, 200), items, use_count: 0 });
      }
      toast(queued ? t("Cihaza kaydedildi; bağlantı gelince gönderilecek.") : t("Günlüğe eklendi."), queued ? "info" : "ok");
      onSaved(date);
    } catch {
      toast(t("Kaydedilemedi. Değerleri kontrol edip tekrar deneyin."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.dataUrl} alt={t("Yemek fotoğrafı")} className="max-h-56 w-full rounded-2xl object-cover" />
      )}

      {(source === "photo" || source === "label") && analysis?.ingredients_text && (
        <ProductNotes
          input={{
            ingredients_text: analysis.ingredients_text,
            per100: source === "label" && items.length === 1 && (items[0].grams ?? 0) > 0 ? per100Of(items[0]) : null,
          }}
        />
      )}

      {analysis?.needs_clarification && onClarify && (
        <Card className="border-warn bg-warn/5">
          <div className="flex gap-2">
            <HelpCircle size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("Porsiyondan emin olamadım")}</p>
              <p className="mt-0.5 text-sm text-muted">{analysis.clarification_question}</p>
              <div className="mt-2 flex gap-2">
                <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder={t("Örn. pilav 1 su bardağı, tavuk avuç içi kadar")} maxLength={400} className="h-10" />
                <Button
                  size="sm"
                  className="h-10 shrink-0"
                  loading={clarifying}
                  disabled={!hint.trim()}
                  onClick={async () => {
                    setClarifying(true);
                    try {
                      await onClarify(hint.trim());
                    } finally {
                      setClarifying(false);
                    }
                  }}
                >
                  {t("Yeniden hesapla")}
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted">{t("Dilerseniz aşağıdaki gramajları doğrudan da düzeltebilirsiniz.")}</p>
            </div>
          </div>
        </Card>
      )}

      {analysis?.notes && <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{analysis.notes}</p>}

      <div className="space-y-2">
        {items.map((it, idx) => (
          <ItemFields
            key={idx}
            item={it}
            onChange={(next) => setItems(items.map((x, i) => (i === idx ? next : x)))}
            onRemove={items.length > 1 ? () => setItems(items.filter((_, i) => i !== idx)) : undefined}
            defaultOpen={source === "manual"}
          />
        ))}
        <Button variant="secondary" size="sm" onClick={() => setItems([...items, blankItem()])}>
          <Plus size={16} />
          {t("Kalem ekle")}
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            [t("Kalori"), Math.round(total.kcal), "kcal", "var(--text)"],
            [t("Protein"), Math.round(total.protein_g), "g", "var(--protein)"],
            [t("Karb."), Math.round(total.carbs_g), "g", "var(--carbs)"],
            [t("Yağ"), Math.round(total.fat_g), "g", "var(--fat)"],
          ].map(([l, v, u, c]) => (
            <div key={l as string}>
              <p className="text-[11px] text-muted">{l}</p>
              <p className="font-semibold" style={{ color: c as string }}>
                {v}
                <span className="ml-0.5 text-xs font-normal text-muted">{u}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <Field label={t("Öğün")}>
          <div className="flex flex-wrap gap-2">
            {MEALS.map((m) => (
              <Chip key={m} active={meal === m} onClick={() => setMeal(m)}>
                {mealLabel(m, lang, profile?.ramadan_mode)}
              </Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Tarih")}>
            <Input type="date" value={date} max={toDateKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <Field label={t("Saat")}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        {source !== "favorite" && (
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              {t("Favorilere ekle")}
            </label>
            {favorite && <Input value={favName} onChange={(e) => setFavName(e.target.value)} placeholder={t("Favori adı")} maxLength={200} className="mt-2" />}
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onCancel} className="flex-1">
          {t("Vazgeç")}
        </Button>
        <Button size="lg" onClick={save} loading={busy} disabled={!valid} className="flex-[2]">
          {t("Onayla ve ekle")}
        </Button>
      </div>
    </div>
  );
}
