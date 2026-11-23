import { createHash } from "node:crypto";
import { z } from "zod";
import { runStructured } from "@/lib/ai/run";
import { authenticate, json, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const request = z.object({
  image: z.object({ data: z.string().min(100).max(6_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) }),
  remaining_kcal: z.number().int().min(0).max(6000),
  remaining_protein_g: z.number().int().min(0).max(400),
  lang: z.enum(["tr", "en"]).default("tr"),
});

const n = z.coerce.number().finite().catch(0).transform((x) => Math.max(0, Math.round(x)));
const result = z.object({
  is_menu: z.boolean().catch(false),
  dishes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(140),
        kcal: n,
        protein_g: n,
        carbs_g: n,
        fat_g: n,
        fit: z.enum(["good", "ok", "avoid"]).catch("ok"),
        reason: z.string().trim().max(200).catch(""),
        tip: z.string().trim().max(200).nullish().catch(null),
        allergen_warning: z.boolean().catch(false),
      }),
    )
    .max(40)
    .catch([]),
});

const SCHEMA = {
  type: "OBJECT",
  properties: {
    is_menu: { type: "BOOLEAN" },
    dishes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, kcal: { type: "NUMBER" }, protein_g: { type: "NUMBER" }, carbs_g: { type: "NUMBER" }, fat_g: { type: "NUMBER" }, fit: { type: "STRING", enum: ["good", "ok", "avoid"] }, reason: { type: "STRING" }, tip: { type: "STRING", nullable: true }, allergen_warning: { type: "BOOLEAN" } },
        required: ["name", "kcal", "protein_g", "carbs_g", "fat_g", "fit", "reason", "allergen_warning"],
      },
    },
  },
  required: ["is_menu", "dishes"],
};

/** Restoran menüsü fotoğrafından, kullanıcının bugünkü kalan hedeflerine uygun seçenekler. */
export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await userClient(auth.token).from("profiles").select("allergies, diet_preferences").maybeSingle();
  const allergies = (profile?.allergies ?? []).join(", ") || "none";
  const diets = (profile?.diet_preferences ?? []).join(", ") || "none";

  return runStructured(req, {
    kind: "menu",
    system: `You help a user of a nutrition app choose from a restaurant menu. Answer in ${input.lang === "en" ? "English" : "Turkish"}. Return ONLY JSON matching the schema.
Read the dishes printed on the menu photo (at most 25, skip drinks unless few dishes). Keep each dish name as printed.
For each dish estimate one typical restaurant serving: kcal, protein_g, carbs_g, fat_g (consistent, 4/4/9 kcal per g; restaurant portions are generous and oily).
"fit": "good" if it fits the user's remaining calories and helps reach the remaining protein, "ok" if acceptable with a small adjustment, "avoid" if it clearly exceeds the remaining calories or conflicts with the diet preferences.
"reason": one short sentence. "tip": optional practical tweak (e.g. sauce on the side, swap fries for salad).
"allergen_warning": true if the dish likely contains any of the user's allergens — such dishes must be "avoid".
If the image is not a menu, set is_menu to false and return no dishes. Never give medical advice.`,
    parts: [
      { inlineData: { mimeType: input.image.mimeType, data: input.image.data } },
      { text: `Remaining today: about ${input.remaining_kcal} kcal and ${input.remaining_protein_g} g protein. Allergies: ${allergies}. Diet preferences: ${diets}.` },
    ],
    responseSchema: SCHEMA,
    validate: result,
    cacheParts: [createHash("sha256").update(input.image.data).digest("hex"), input.lang, String(Math.round(input.remaining_kcal / 100)), String(Math.round(input.remaining_protein_g / 10)), allergies, diets],
    temperature: 0.2,
    maxOutputTokens: 6000,
  });
}
