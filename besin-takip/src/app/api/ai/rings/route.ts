import { createHash } from "node:crypto";
import { z } from "zod";
import { runStructured } from "@/lib/ai/run";
import { json } from "@/lib/supabase/server";

export const maxDuration = 60;

const request = z.object({ image: z.object({ data: z.string().min(100).max(6_000_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) }) });

const int = (max: number) =>
  z.coerce
    .number()
    .finite()
    .nullish()
    .catch(null)
    .transform((n) => (n == null || n < 0 || n > max ? null : Math.round(n)));

/** Ekran görüntüsünden okunan değerler; okunamayan alan null kalır (uydurulmaz). */
const result = z.object({
  is_rings: z.boolean().catch(false),
  move_kcal: int(20000),
  move_goal: int(20000),
  exercise_min: int(1440),
  exercise_goal: int(1440),
  stand_hours: int(24),
  stand_goal: int(24),
  steps: int(200000),
  distance_km: z.coerce.number().finite().nullish().catch(null).transform((n) => (n == null || n < 0 || n > 500 ? null : Math.round(n * 100) / 100)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().catch(null),
});

const N = { type: "NUMBER", nullable: true };
const SCHEMA = {
  type: "OBJECT",
  properties: { is_rings: { type: "BOOLEAN" }, move_kcal: N, move_goal: N, exercise_min: N, exercise_goal: N, stand_hours: N, stand_goal: N, steps: N, distance_km: N, date: { type: "STRING", nullable: true } },
  required: ["is_rings"],
};

const SYSTEM = `You read screenshots of smartwatch / phone health summaries (Apple Fitness activity rings, Samsung Health, Google Fit, Huawei Health, Garmin, Xiaomi and similar).
Return ONLY JSON matching the schema. Copy the numbers shown on the screen; never estimate or invent a value. Use null for anything not visible.
- move_kcal / move_goal: active (move) calories and their goal, in kcal.
- exercise_min / exercise_goal: exercise or active minutes and their goal.
- stand_hours / stand_goal: stand hours and goal (Apple). Null on other platforms unless shown.
- steps, distance_km: step count and distance (convert miles to km).
- date: the day the summary is for as YYYY-MM-DD only if a full date is visible, else null.
If the image is not a health/activity summary, set is_rings to false and everything else to null.`;

export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const { image } = parsed.data;
  return runStructured(req, {
    kind: "rings",
    system: SYSTEM,
    parts: [{ inlineData: { mimeType: image.mimeType, data: image.data } }, { text: "Read the activity values from this screenshot." }],
    responseSchema: SCHEMA,
    validate: result,
    cacheParts: [createHash("sha256").update(image.data).digest("hex")],
    temperature: 0,
  });
}
