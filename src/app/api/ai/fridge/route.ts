import { createHash } from "node:crypto";
import { z } from "zod";
import { runStructured } from "@/lib/ai/run";
import { authenticate, json, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const image = z.object({ data: z.string().min(100).max(6_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
const location = z.enum(["fridge", "freezer", "pantry"]);

const request = z.discriminatedUnion("mode", [
  /** Fotoğraflardan ürünleri ve (okunabiliyorsa) son tüketim tarihlerini okur. */
  z.object({ mode: z.literal("scan"), lang: z.enum(["tr", "en"]).default("tr"), location, today: dateKey, images: z.array(image).min(1).max(3) }),
  /** Envanterdeki ürünlerle yemek önerir; süresi yaklaşanlara öncelik verir. */
  z.object({
    mode: z.literal("suggest"),
    lang: z.enum(["tr", "en"]).default("tr"),
    inventory: z.array(z.object({ name: z.string().trim().min(1).max(80), location, days_left: z.number().int().min(-1).max(1100).nullable() })).min(1).max(40),
    meal_kcal: z.number().int().min(0).max(3000).optional(),
    meal_protein_g: z.number().int().min(0).max(200).optional(),
  }),
]);

const n = z.coerce.number().finite().catch(0).transform((x) => Math.max(0, Math.round(x)));
const list = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max).catch([]);

const scanResult = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        expires_on: dateKey.nullable().catch(null),
        shelf_days: z.coerce.number().finite().nullable().catch(null).transform((x) => (x == null ? null : Math.min(1100, Math.max(0, Math.round(x))))),
      }),
    )
    .max(40),
});
const suggestResult = z.object({
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

const SCAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, expires_on: { type: "STRING", nullable: true }, shelf_days: { type: "NUMBER", nullable: true } },
        required: ["name"],
      },
    },
  },
  required: ["items"],
};
const SUGGEST_SCHEMA = {
  type: "OBJECT",
  properties: {
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
  required: ["recipes"],
};

const PLACE = { fridge: "refrigerator", freezer: "freezer", pantry: "pantry or cupboard" } as const;

/** Buzdolabı / buzluk / dolap envanteri: ürünleri fotoğraftan okur ve envanterden yemek önerir. */
export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;
  const lang = input.lang === "en" ? "English" : "Turkish";

  if (input.mode === "scan") {
    const place = PLACE[input.location];
    return runStructured(req, {
      kind: "fridge_scan",
      system: `You read photos of a person's ${place} for a nutrition app called BKNY. Answer in ${lang}. Return ONLY JSON matching the schema.
List the edible food items you can actually see in "items": short common names, no brands, no quantities, merge duplicates, at most 40. Ignore containers, shelves and non-food things, and never guess items you cannot see; when unsure leave the item out.
For each item:
- "expires_on": ONLY if a use-by / best-before / "son tüketim tarihi" (STT/SKT) date is clearly legible on that item's package, give it as YYYY-MM-DD. Otherwise null. Never invent a date.
- "shelf_days": your conservative estimate of how many days from today (${input.today}) the item stays good if kept as shown in the ${place} (examples: fresh leafy greens in a fridge 3-5, cooked leftovers 2-3, opened milk 4-5, eggs 21, hard cheese 21, raw meat in a fridge 2, most raw meat or fish in a freezer 90-180, frozen vegetables 240, bread in a freezer 90, dry pasta/rice/legumes in a pantry 365). Use null only if you cannot judge.
These are rough estimates, not safety guarantees. If there is no food in the photos return an empty list.`,
      parts: [...input.images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.data } })), { text: `Photos of my ${place}. Today is ${input.today}.` }],
      responseSchema: SCAN_SCHEMA,
      validate: scanResult,
      cacheParts: ["scan", input.lang, input.location, input.today, ...input.images.map((im) => createHash("sha256").update(im.data).digest("hex"))],
      temperature: 0.2,
      maxOutputTokens: 3072,
    });
  }

  // Alerji ve tercihler istemciden değil, kullanıcının kendi profilinden okunur.
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await userClient(auth.token).from("profiles").select("allergies, diet_preferences").maybeSingle();
  const allergies = (profile?.allergies ?? []).join(", ") || "none";
  const diets = (profile?.diet_preferences ?? []).join(", ") || "none";
  const lines = input.inventory
    .filter((i) => i.days_left == null || i.days_left >= 0)
    .map((i) => `- ${i.name} | ${i.location}${i.days_left != null ? ` | ${i.days_left} day(s) left` : ""}`);
  if (!lines.length) return json({ error: "bad_request" }, 400);

  return runStructured(req, {
    kind: "fridge",
    system: `You are a kitchen assistant inside a nutrition tracking app called BKNY. Answer in ${lang}. Return ONLY JSON matching the schema.
The user's inventory is listed as "item | location | days left until its use-by estimate". Suggest 3 recipes, one serving each, that use mainly these items.
PRIORITY: build the recipes around items that have few days left (0-3 days) first, so nothing goes to waste. Frozen items need thawing: mention it as the first step in "steps" and prefer them when the user can plan ahead. Basic pantry staples (salt, pepper, oil, water, dried spices) may be assumed.
"uses" = the inventory items the recipe uses (use the inventory wording). "missing" = important ingredients NOT in the inventory; prefer none, at most 2. Familiar Turkish home cooking or simple international dishes, at most 30 minutes of active work. "meal" is the meal the dish suits.
Nutrient values are per serving and must be realistic and consistent (4/4/9 kcal per g). "steps" are short numbered steps in one string. "why" is one short sentence (mention if it uses something that should be eaten soon).
STRICTLY exclude every ingredient the user is allergic to and respect the diet preferences. Never claim that any food is safe to eat; the days left are estimates.
Never give medical advice and never recommend supplements or medication.`,
    parts: [
      {
        text: `My inventory:\n${lines.join("\n")}
${input.meal_kcal ? `A meal should be around ${input.meal_kcal} kcal${input.meal_protein_g ? ` and ${input.meal_protein_g} g protein` : ""}.` : ""}
Allergies: ${allergies}. Diet preferences: ${diets}.`,
      },
    ],
    responseSchema: SUGGEST_SCHEMA,
    validate: suggestResult,
    cacheParts: [
      "suggest",
      input.lang,
      lines.sort().join("|"),
      String(Math.round((input.meal_kcal ?? 0) / 100)),
      String(Math.round((input.meal_protein_g ?? 0) / 10)),
      allergies,
      diets,
    ],
    temperature: 0.5,
    maxOutputTokens: 4096,
  });
}
