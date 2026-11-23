import { createHash } from "node:crypto";
import { z } from "zod";
import { runStructured } from "@/lib/ai/run";
import { authenticate, json, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const image = z.object({ data: z.string().min(100).max(6_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
const request = z
  .object({
    lang: z.enum(["tr", "en"]).default("tr"),
    images: z.array(image).max(3).optional(),
    /** Kullanıcının düzelttiği ya da yazdığı malzeme listesi (fotoğraf yoksa). */
    ingredients: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
    meal_kcal: z.number().int().min(0).max(3000).optional(),
    meal_protein_g: z.number().int().min(0).max(200).optional(),
  })
  .refine((v) => !!v.images?.length || !!v.ingredients?.length, { message: "missing_input" });

const n = z.coerce.number().finite().catch(0).transform((x) => Math.max(0, Math.round(x)));
const list = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max).catch([]);
const result = z.object({
  ingredients: list(40),
  recipes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).catch("lunch"),
        kcal: n,
        protein_g: n,
        carbs_g: n,
        fat_g: n,
        minutes: n,
        uses: list(15),
        missing: list(6),
        steps: z.string().trim().min(1).max(900),
        why: z.string().trim().max(240).catch(""),
      }),
    )
    .max(4),
});

const SCHEMA = {
  type: "OBJECT",
  properties: {
    ingredients: { type: "ARRAY", items: { type: "STRING" } },
    recipes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          meal: { type: "STRING", enum: ["breakfast", "lunch", "dinner", "snack"] },
          kcal: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
          minutes: { type: "NUMBER" },
          uses: { type: "ARRAY", items: { type: "STRING" } },
          missing: { type: "ARRAY", items: { type: "STRING" } },
          steps: { type: "STRING" },
          why: { type: "STRING" },
        },
        required: ["name", "meal", "kcal", "protein_g", "carbs_g", "fat_g", "minutes", "uses", "steps"],
      },
    },
  },
  required: ["ingredients", "recipes"],
};

/** Buzdolabı/dolap fotoğrafından (ya da yazılan malzemelerden) elde bulunanlarla yapılabilecek yemek önerileri. */
export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;
  // Alerji ve tercihler istemciden değil, kullanıcının kendi profilinden okunur.
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await userClient(auth.token).from("profiles").select("allergies, diet_preferences").maybeSingle();
  const allergies = (profile?.allergies ?? []).join(", ") || "none";
  const diets = (profile?.diet_preferences ?? []).join(", ") || "none";
  const hasImages = !!input.images?.length;
  const list_ = (input.ingredients ?? []).map((s) => s.toLowerCase());

  return runStructured(req, {
    kind: "fridge",
    system: `You are a kitchen assistant inside a nutrition tracking app called BKNY. Answer in ${input.lang === "en" ? "English" : "Turkish"}. Return ONLY JSON matching the schema.
INGREDIENTS: ${
      hasImages
        ? 'The user sent photos of their fridge or pantry. In "ingredients" list the edible ingredients you can actually see: short common names, no brands, no quantities, merge duplicates, at most 30. Ignore containers, labels and non-food items, and never guess items you cannot see. If unsure about an item, leave it out.'
        : 'The user typed the ingredients they have. Return them in "ingredients", cleaned up (short common names, deduplicated).'
    }
RECIPES: suggest 3 recipes, one serving each, that use mainly the listed ingredients. Basic pantry staples (salt, pepper, oil, water, dried spices) may be assumed. "uses" = the listed ingredients the recipe uses. "missing" = important ingredients that are NOT in the list; prefer none, at most 2. Familiar Turkish home cooking or simple international dishes, at most 30 minutes. "meal" is the meal the dish suits.
Nutrient values are per serving and must be realistic and consistent (4/4/9 kcal per g). "steps" are short numbered steps in one string. "why" is one short sentence.
STRICTLY exclude every ingredient the user is allergic to and respect the diet preferences. If there is no food in the photos or the list is empty, return empty "ingredients" and empty "recipes".
Never give medical advice and never recommend supplements or medication.`,
    parts: [
      ...(input.images ?? []).map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.data } })),
      {
        text: `${hasImages ? "Photos of my fridge or pantry are attached." : `Ingredients I have: ${list_.join(", ")}.`}
${input.meal_kcal ? `A meal should be around ${input.meal_kcal} kcal${input.meal_protein_g ? ` and ${input.meal_protein_g} g protein` : ""}.` : ""}
Allergies: ${allergies}. Diet preferences: ${diets}.`,
      },
    ],
    responseSchema: SCHEMA,
    validate: result,
    cacheParts: [
      input.lang,
      ...(input.images ?? []).map((im) => createHash("sha256").update(im.data).digest("hex")),
      [...list_].sort().join(","),
      String(Math.round((input.meal_kcal ?? 0) / 100)),
      String(Math.round((input.meal_protein_g ?? 0) / 10)),
      allergies,
      diets,
    ],
    temperature: 0.5,
    maxOutputTokens: 4096,
  });
}
