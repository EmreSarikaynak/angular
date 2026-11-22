import { z } from "zod";

const num = z.coerce.number().finite().catch(0);
const nonNeg = num.transform((n) => (n < 0 ? 0 : n));
const conf = z.coerce.number().finite().catch(0.5).transform((n) => Math.min(1, Math.max(0, n)));

/** Gemini'den gelen ham analiz çıktısı. Eksik/bozuk alanlar güvenli varsayılana çekilir. */
export const rawItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ref_key: z.string().trim().max(60).nullish(),
  quantity: z.coerce.number().finite().nullish().catch(null),
  unit: z.string().trim().max(40).nullish(),
  grams: nonNeg,
  kcal: nonNeg,
  protein_g: nonNeg,
  carbs_g: nonNeg,
  fat_g: nonNeg,
  sugar_g: nonNeg,
  fiber_g: nonNeg,
  salt_g: nonNeg,
  alcohol_g: nonNeg.optional().default(0),
  confidence: conf,
  iron_mg: z.coerce.number().finite().nullish().catch(null),
  calcium_mg: z.coerce.number().finite().nullish().catch(null),
  magnesium_mg: z.coerce.number().finite().nullish().catch(null),
  potassium_mg: z.coerce.number().finite().nullish().catch(null),
  vitamin_c_mg: z.coerce.number().finite().nullish().catch(null),
  vitamin_b12_mcg: z.coerce.number().finite().nullish().catch(null),
  vitamin_d_mcg: z.coerce.number().finite().nullish().catch(null),
});

export const rawAnalysisSchema = z.object({
  is_food: z.boolean().catch(true),
  dish_name: z.string().trim().max(200).catch(""),
  items: z.array(rawItemSchema).max(30).catch([]),
  overall_confidence: conf,
  needs_clarification: z.boolean().catch(false),
  clarification_question: z.string().trim().max(400).nullish(),
  notes: z.string().trim().max(600).nullish(),
});

export type RawItem = z.infer<typeof rawItemSchema>;
export type RawAnalysis = z.infer<typeof rawAnalysisSchema>;

/** Gemini `responseSchema` (OpenAPI alt kümesi). */
export const ANALYSIS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_food: { type: "BOOLEAN" },
    dish_name: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          ref_key: { type: "STRING", nullable: true },
          quantity: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          grams: { type: "NUMBER" },
          kcal: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
          sugar_g: { type: "NUMBER" },
          fiber_g: { type: "NUMBER" },
          salt_g: { type: "NUMBER" },
          alcohol_g: { type: "NUMBER" },
          confidence: { type: "NUMBER" },
          iron_mg: { type: "NUMBER", nullable: true },
          calcium_mg: { type: "NUMBER", nullable: true },
          magnesium_mg: { type: "NUMBER", nullable: true },
          potassium_mg: { type: "NUMBER", nullable: true },
          vitamin_c_mg: { type: "NUMBER", nullable: true },
          vitamin_b12_mcg: { type: "NUMBER", nullable: true },
          vitamin_d_mcg: { type: "NUMBER", nullable: true },
        },
        required: ["name", "grams", "kcal", "protein_g", "carbs_g", "fat_g", "sugar_g", "fiber_g", "salt_g", "confidence"],
      },
    },
    overall_confidence: { type: "NUMBER" },
    needs_clarification: { type: "BOOLEAN" },
    clarification_question: { type: "STRING", nullable: true },
    notes: { type: "STRING", nullable: true },
  },
  required: ["is_food", "dish_name", "items", "overall_confidence", "needs_clarification"],
} as const;

/** İstemciden gelen analiz isteği. */
export const analyzeRequestSchema = z
  .object({
    kind: z.enum(["photo", "text", "label"]),
    text: z.string().trim().max(1000).optional(),
    image: z
      .object({
        data: z.string().min(100).max(6_000_000),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .optional(),
    hint: z.string().trim().max(400).optional(),
    lang: z.enum(["tr", "en"]).default("tr"),
  })
  .refine((v) => (v.kind === "text" ? !!v.text : !!v.image), { message: "missing_input" });

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(1500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
  lang: z.enum(["tr", "en"]).default("tr"),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
