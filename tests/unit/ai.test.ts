import { describe, expect, it } from "vitest";
import { postProcessAnalysis } from "@/lib/ai/postprocess";
import { analyzeRequestSchema, assistantRequestSchema } from "@/lib/ai/schemas";
import { parseJsonLoose } from "@/lib/ai/gemini";
import { cacheKey, estimateCost } from "@/lib/ai/guard";

const item = (o: Record<string, unknown>) => ({ name: "x", grams: 100, kcal: 100, protein_g: 5, carbs_g: 10, fat_g: 4, sugar_g: 1, fiber_g: 1, salt_g: 0.1, confidence: 0.9, ...o });
const base = (items: unknown[], o: Record<string, unknown> = {}) => ({ is_food: true, dish_name: "Tabak", items, overall_confidence: 0.9, needs_clarification: false, ...o });

describe("analiz son işleme", () => {
  it("tanınan yiyeceğin değerleri modelden değil referans tablodan gelir", () => {
    const r = postProcessAnalysis(base([item({ name: "Izgara tavuk", ref_key: "chicken_breast_grilled", grams: 150, kcal: 999, protein_g: 1 })]), "photo", "tr");
    expect(r.items[0]).toMatchObject({ kcal: 248, protein_g: 46.5, data_source: "reference", is_estimated: true });
  });

  it("yazıyla kesin gramaj + referans = tahmini değil", () => {
    const r = postProcessAnalysis(base([item({ ref_key: "chicken_breast_grilled", grams: 150, confidence: 0.95 })]), "text", "tr");
    expect(r.items[0].is_estimated).toBe(false);
  });

  it("bilinmeyen anahtar yok sayılır, YZ değeri tahmini işaretlenir", () => {
    const r = postProcessAnalysis(base([item({ ref_key: "uydurma_anahtar" })]), "photo", "tr");
    expect(r.items[0]).toMatchObject({ data_source: "ai", is_estimated: true, kcal: 100 });
  });

  it("makrolarla çelişen kalori düzeltilir ve güven düşürülür", () => {
    const r = postProcessAnalysis(base([item({ kcal: 900, protein_g: 10, carbs_g: 20, fat_g: 5 })]), "photo", "tr");
    expect(r.items[0].kcal).toBe(165);
    expect(r.items[0].confidence).toBeLessThanOrEqual(0.5);
  });

  it("düşük güven porsiyon sorusu üretir", () => {
    const r = postProcessAnalysis(base([item({ name: "Pilav", confidence: 0.3 })], { overall_confidence: 0.8 }), "photo", "tr");
    expect(r.needs_clarification).toBe(true);
    expect(r.clarification_question).toContain("Pilav");
    const en = postProcessAnalysis(base([item({})], { overall_confidence: 0.4 }), "photo", "en");
    expect(en.clarification_question).toMatch(/portion/i);
  });

  it("yüksek güven soru sormaz", () => {
    expect(postProcessAnalysis(base([item({})]), "text", "tr").needs_clarification).toBe(false);
  });

  it("yiyecek yoksa is_food false", () => {
    expect(postProcessAnalysis(base([], { is_food: true }), "photo", "tr").is_food).toBe(false);
    expect(postProcessAnalysis(base([item({})], { is_food: false }), "photo", "tr").is_food).toBe(false);
  });

  it("bozuk alanlar güvenli değerlere çekilir, negatifler sıfırlanır", () => {
    const r = postProcessAnalysis(base([{ name: "Şey", grams: "abc", kcal: -50, protein_g: null, carbs_g: "12", fat_g: 2, sugar_g: 99, fiber_g: 0, salt_g: 0, confidence: 7 }]), "text", "tr");
    expect(r.items[0].carbs_g).toBe(12);
    expect(r.items[0].sugar_g).toBe(12);
    expect(r.items[0].kcal).toBeGreaterThanOrEqual(0);
    expect(r.items[0].confidence).toBeLessThanOrEqual(1);
  });

  it("şemaya hiç uymayan yanıt reddedilir", () => {
    expect(() => postProcessAnalysis("merhaba", "text", "tr")).toThrow("invalid_ai_response");
    expect(() => postProcessAnalysis(null, "text", "tr")).toThrow();
  });

  it("etiket: referans kullanılmaz, kaynak 'label'", () => {
    const r = postProcessAnalysis(base([item({ ref_key: "biscuit", grams: 30, kcal: 140, protein_g: 2, carbs_g: 20, fat_g: 5.5 })]), "label", "tr");
    expect(r.items[0]).toMatchObject({ data_source: "label", is_estimated: false, kcal: 140 });
    expect(r.needs_clarification).toBe(false);
  });
});

describe("istek doğrulama", () => {
  it("metin isteği metin ister, fotoğraf isteği görsel ister", () => {
    expect(analyzeRequestSchema.safeParse({ kind: "text" }).success).toBe(false);
    expect(analyzeRequestSchema.safeParse({ kind: "text", text: "2 yumurta" }).success).toBe(true);
    expect(analyzeRequestSchema.safeParse({ kind: "photo", text: "x" }).success).toBe(false);
    expect(analyzeRequestSchema.safeParse({ kind: "photo", image: { data: "a".repeat(200), mimeType: "image/gif" } }).success).toBe(false);
    expect(analyzeRequestSchema.safeParse({ kind: "text", text: "a".repeat(1001) }).success).toBe(false);
  });
  it("asistan isteği", () => {
    expect(assistantRequestSchema.safeParse({ message: "", today: "2026-01-01" }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ message: "selam", today: "bugün" }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ message: "selam", today: "2026-01-01" }).success).toBe(true);
  });
});

describe("yardımcılar", () => {
  it("JSON gevşek ayrıştırma", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sonuç: {"a":2} bitti')).toEqual({ a: 2 });
    expect(() => parseJsonLoose("yok")).toThrow();
  });
  it("önbellek anahtarı kararlı ve girdiye duyarlı", () => {
    expect(cacheKey(["a", "b"])).toBe(cacheKey(["a", "b"]));
    expect(cacheKey(["a", "b"])).not.toBe(cacheKey(["ab", ""]));
  });
  it("maliyet tahmini", () => {
    expect(estimateCost(1_000_000, 1_000_000, { price_input_per_m: 0.75, price_output_per_m: 3.75 })).toBeCloseTo(4.5);
  });
});
