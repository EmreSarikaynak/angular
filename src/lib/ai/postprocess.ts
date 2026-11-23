import type { AnalysisResult, FoodItem } from "../types";
import { kcalFromMacros, roundNutrients } from "../nutrition/calc";
import { nutrientsFromReference, referenceFood } from "../nutrition/reference-foods";
import { rawAnalysisSchema, type RawItem } from "./schemas";
import { cleanMicros } from "../nutrition/micros";

/** Bu eşiğin altında kullanıcıya porsiyon sorulur. */
export const LOW_CONFIDENCE = 0.6;
const ITEM_LOW_CONFIDENCE = 0.5;

export type AnalysisKind = "photo" | "text" | "label";

function processItem(raw: RawItem, kind: AnalysisKind): FoodItem {
  const grams = Math.min(raw.grams, 5000);
  const ref = kind === "label" ? undefined : referenceFood(raw.ref_key);

  if (ref && grams > 0) {
    // Tanınan yiyecek: besin değerleri modelin tahmininden değil referans tablosundan hesaplanır.
    const n = nutrientsFromReference(ref, grams);
    return {
      name: raw.name,
      quantity: raw.quantity ?? null,
      unit: raw.unit ?? null,
      grams,
      ...n,
      alcohol_g: raw.alcohol_g ?? 0,
      kcal: n.kcal + Math.round((raw.alcohol_g ?? 0) * 7),
      confidence: raw.confidence,
      // Fotoğrafta gramaj her zaman tahmindir; yazıda kullanıcı gram verdiyse değildir.
      is_estimated: kind === "photo" || raw.confidence < 0.8,
      data_source: "reference",
      micros: cleanMicros(raw),
    };
  }

  const item: FoodItem = roundNutrients({
    name: raw.name,
    quantity: raw.quantity ?? null,
    unit: raw.unit ?? null,
    grams: grams || null,
    kcal: raw.kcal,
    protein_g: raw.protein_g,
    carbs_g: raw.carbs_g,
    fat_g: raw.fat_g,
    sugar_g: Math.min(raw.sugar_g, raw.carbs_g),
    fiber_g: Math.min(raw.fiber_g, raw.carbs_g),
    salt_g: raw.salt_g,
    alcohol_g: raw.alcohol_g ?? 0,
    confidence: raw.confidence,
    is_estimated: kind !== "label",
    data_source: kind === "label" ? "label" : "ai",
    micros: cleanMicros(raw),
  });

  // Tutarlılık denetimi: kalori, makrolardan hesaplanan enerjiyle %25'ten fazla
  // çelişiyorsa makrolara güven ve kaydı tahmini olarak işaretle.
  const fromMacros = kcalFromMacros(item);
  if (fromMacros > 20) {
    const diff = Math.abs(item.kcal - fromMacros) / fromMacros;
    if (item.kcal <= 0 || diff > 0.25) {
      item.kcal = Math.round(fromMacros);
      item.is_estimated = true;
      item.confidence = Math.min(item.confidence ?? 0.5, 0.5);
    }
  }
  // Makro toplamı gramajı aşamaz.
  if (item.grams && item.protein_g + item.carbs_g + item.fat_g > item.grams * 1.02) {
    item.is_estimated = true;
    item.confidence = Math.min(item.confidence ?? 0.4, 0.4);
  }
  item.kcal = Math.min(item.kcal, 10000);
  return item;
}

/** Ham Gemini JSON'unu doğrular, referans tablosuyla destekler ve güven seviyesini değerlendirir. */
export function postProcessAnalysis(raw: unknown, kind: AnalysisKind, lang: "tr" | "en"): AnalysisResult {
  const parsed = rawAnalysisSchema.safeParse(raw);
  if (!parsed.success) throw new Error("invalid_ai_response");
  const data = parsed.data;

  const items = data.items.map((it) => processItem(it, kind));
  const isFood = data.is_food && items.length > 0;
  const lowItems = items.filter((i) => (i.confidence ?? 1) < ITEM_LOW_CONFIDENCE);
  const needs = isFood && kind !== "label" && (data.needs_clarification || data.overall_confidence < LOW_CONFIDENCE || lowItems.length > 0);

  let question = data.clarification_question?.trim() || null;
  if (needs && !question) {
    const names = (lowItems.length ? lowItems : items).map((i) => i.name).join(", ");
    question =
      lang === "en"
        ? `I could not determine the portion sizes reliably. How much did you have of: ${names}?`
        : `Porsiyon miktarını güvenilir biçimde belirleyemedim. Şunlardan ne kadar yediniz: ${names}?`;
  }

  return {
    is_food: isFood,
    dish_name: data.dish_name || items.map((i) => i.name).slice(0, 3).join(", "),
    items,
    overall_confidence: data.overall_confidence,
    needs_clarification: needs,
    clarification_question: needs ? question : null,
    notes: data.notes?.trim() || null,
  };
}
