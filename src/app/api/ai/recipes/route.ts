import { z } from "zod";
import { runStructured } from "@/lib/ai/run";
import { authenticate, json, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const request = z.object({
  focus: z.enum(["high_protein", "low_cal", "low_sugar", "low_salt", "low_fat", "high_fiber"]),
  remaining_kcal: z.number().int().min(0).max(6000),
  remaining_protein_g: z.number().int().min(0).max(400),
  lang: z.enum(["tr", "en"]).default("tr"),
});

const n = z.coerce.number().finite().catch(0).transform((x) => Math.max(0, Math.round(x)));
const result = z.object({
  recipes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        kcal: n,
        protein_g: n,
        carbs_g: n,
        fat_g: n,
        minutes: n,
        ingredients: z.array(z.string().trim().min(1).max(120)).min(1).max(15),
        steps: z.string().trim().min(1).max(900),
        why: z.string().trim().max(240).catch(""),
      }),
    )
    .min(1)
    .max(4),
});

const SCHEMA = {
  type: "OBJECT",
  properties: {
    recipes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, kcal: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" }, minutes: { type: "NUMBER" }, ingredients: { type: "ARRAY", items: { type: "STRING" } }, steps: { type: "STRING" }, why: { type: "STRING" } },
        required: ["name", "kcal", "protein_g", "carbs_g", "fat_g", "minutes", "ingredients", "steps"],
      },
    },
  },
  required: ["recipes"],
};

const FOCUS: Record<string, string> = {
  high_protein: "high in protein relative to calories",
  low_cal: "light and low in calories but filling",
  low_sugar: "low in sugar; satisfying alternatives to sweet snacks",
  low_salt: "low in salt, flavoured with herbs, spices and lemon instead",
  low_fat: "low in fat",
  high_fiber: "high in fibre (legumes, vegetables, whole grains)",
};

/** Kullanıcının kalan kalorisi, alerjileri ve tercihlerine göre kişisel tarif önerileri. */
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

  return runStructured(req, {
    kind: "recipes",
    system: `You suggest simple home recipes for a nutrition tracking app called BKN. Answer in ${input.lang === "en" ? "English" : "Turkish"}. Return ONLY JSON matching the schema.
Rules: 3 recipes, one serving each, familiar Turkish home cooking or simple international dishes, ingredients available in a regular Turkish supermarket, at most 30 minutes.
Nutrient values are per serving and must be realistic and consistent (4/4/9 kcal per g).
STRICTLY exclude every ingredient the user is allergic to and respect the diet preferences.
Never give medical advice and never recommend supplements or medication. "why" is one short sentence on why it fits the goal.`,
    parts: [
      {
        text: `Goal: recipes that are ${FOCUS[input.focus]}.
Calories left today: about ${input.remaining_kcal} kcal. Protein still needed today: about ${input.remaining_protein_g} g.
Allergies: ${allergies}. Diet preferences: ${diets}.`,
      },
    ],
    responseSchema: SCHEMA,
    validate: result,
    cacheParts: [input.focus, input.lang, String(Math.round(input.remaining_kcal / 100)), String(Math.round(input.remaining_protein_g / 10)), allergies, diets],
    temperature: 0.6,
  });
}
