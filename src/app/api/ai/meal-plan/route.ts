import { z } from "zod";
import { runStructured } from "@/lib/ai/run";
import { authenticate, json, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const request = z.object({ lang: z.enum(["tr", "en"]).default("tr"), note: z.string().trim().max(200).optional(), ramadan: z.boolean().optional() });

const n = z.coerce.number().finite().catch(0).transform((x) => Math.max(0, Math.round(x)));
const meal = z.object({ slot: z.enum(["breakfast", "lunch", "dinner", "snack"]), name: z.string().trim().min(1).max(140), kcal: n, protein_g: n, carbs_g: n, fat_g: n });
const result = z.object({
  days: z.array(z.object({ day: z.coerce.number().int().min(1).max(7), meals: z.array(meal).min(3).max(5) })).length(7),
  shopping: z.array(z.object({ category: z.string().trim().min(1).max(60), items: z.array(z.string().trim().min(1).max(100)).min(1).max(25) })).min(1).max(12),
});

const SCHEMA = {
  type: "OBJECT",
  properties: {
    days: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          day: { type: "NUMBER" },
          meals: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { slot: { type: "STRING", enum: ["breakfast", "lunch", "dinner", "snack"] }, name: { type: "STRING" }, kcal: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" } },
              required: ["slot", "name", "kcal", "protein_g", "carbs_g", "fat_g"],
            },
          },
        },
        required: ["day", "meals"],
      },
    },
    shopping: { type: "ARRAY", items: { type: "OBJECT", properties: { category: { type: "STRING" }, items: { type: "ARRAY", items: { type: "STRING" } } }, required: ["category", "items"] } },
  },
  required: ["days", "shopping"],
};

/** Kullanıcının hedeflerine, alerjilerine ve tercihlerine göre 7 günlük öğün planı + alışveriş listesi. */
export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const { data: p } = await userClient(auth.token).from("profiles").select("kcal_target, protein_target_g, carbs_target_g, fat_target_g, allergies, diet_preferences, goal, iftar_time, sahur_time").maybeSingle();
  if (!p?.kcal_target) return json({ error: "profile_incomplete" }, 400);
  const { lang, note, ramadan } = parsed.data;
  const ramadanRules = ramadan
    ? `\nRAMADAN FASTING MODE (this overrides the meal list above): the user is fasting. Do NOT plan lunch. Each day has exactly three meals in this order: "dinner" = iftar (break the fast at ${p.iftar_time ?? "19:00"} with water and dates, then soup and a protein-rich main), "snack" = a protein-rich evening snack about 2 hours after iftar, "breakfast" = suhoor (pre-dawn meal that ends by ${p.sahur_time ?? "04:30"}: eggs, cheese, yogurt, whole grains, filling and not salty). Spread protein across the three meals (about 35% iftar, 25% snack, 40% suhoor) while the daily totals still meet the targets. Favour hydrating foods and avoid very salty or fried dishes. Mention iftar/suhoor in meal names where natural.`
    : "";

  return runStructured(req, {
    kind: "meal_plan",
    system: `You are a meal planner for a nutrition tracking app called BKNY. Answer in ${lang === "en" ? "English" : "Turkish"}. Return ONLY JSON matching the schema.
Plan exactly 7 days (day 1..7). Each day has breakfast, lunch, dinner and one snack.${ramadanRules}
Each meal "name" is a short description with portions (e.g. "150 g ızgara tavuk, 150 g bulgur pilavı, salata").
Daily totals must be within 5% of the calorie target and reach at least 90% of the protein target. Nutrients are per meal and consistent (4/4/9 kcal per g).
Use familiar Turkish home cooking and simple international dishes; vary the meals; reuse ingredients across days to keep shopping practical.
STRICTLY exclude every ingredient the user is allergic to and respect all diet preferences.
"shopping": one consolidated list for the whole week, grouped into 5-8 categories (vegetables & fruit, meat & fish, dairy & eggs, grains & legumes, other), each item with an approximate total quantity.
Never give medical advice and never include supplements or medication.`,
    parts: [
      {
        text: `Daily targets: ${p.kcal_target} kcal, protein ${p.protein_target_g ?? "-"} g, carbs ${p.carbs_target_g ?? "-"} g, fat ${p.fat_target_g ?? "-"} g. Goal: ${p.goal ?? "maintain"}.
Allergies: ${(p.allergies ?? []).join(", ") || "none"}. Diet preferences: ${(p.diet_preferences ?? []).join(", ") || "none"}.${note ? `\nUser request for this week: "${note}"` : ""}`,
      },
    ],
    responseSchema: SCHEMA,
    validate: result,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });
}
