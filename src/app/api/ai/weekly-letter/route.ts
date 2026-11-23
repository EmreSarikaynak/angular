import { z } from "zod";
import { guardAi, recordUsage } from "@/lib/ai/guard";
import { generate, GeminiError } from "@/lib/ai/gemini";
import { buildAssistantContext } from "@/lib/ai/context";
import { addDays } from "@/lib/dates";
import { authenticate, json, logError, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;
const request = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), lang: z.enum(["tr", "en"]).default("tr") });

/**
 * Haftalık mektup: son 7 günün kısa, kişisel değerlendirmesi. Haftada bir kez üretilir;
 * aynı hafta içinde yeniden istenirse kayıtlı mektup döner ve yapay zekâ kotası harcanmaz.
 */
export async function POST(req: Request) {
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const { today, lang } = parsed.data;
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const db = userClient(auth.token);

  const { data: recent } = await db.from("weekly_letters").select("id, entry_date, content, created_at").gt("entry_date", addDays(today, -7)).order("entry_date", { ascending: false }).limit(1);
  if (recent?.[0]) return json({ letter: recent[0], existing: true });

  const guard = await guardAi(req, "weekly_letter");
  if (!guard.ok) return guard.response;
  const { settings } = guard;
  try {
    const context = await buildAssistantContext(db, today);
    const week = context.last_14_days.filter((d) => d.date > addDays(today, -7));
    if (week.length === 0) return json({ error: "no_data" }, 400);
    const out = await generate({
      model: settings.gemini_model,
      temperature: 0.6,
      maxOutputTokens: 1200,
      system: `You write a short, warm weekly letter for the user of a wellbeing app called BKN ("Bugün kendin için ne yaptın?" — "What have you done for yourself today?"). Write in ${lang === "en" ? "English" : "Turkish"}, addressing the user by first name, informal and encouraging, never judgemental.
Structure (plain text, no headings, no markdown, 130-190 words):
1) One sentence opening that names something real they did this week.
2) Two or three concrete observations with actual numbers from the data (compare this week with the previous week when both exist).
3) One gentle, specific suggestion for next week that fits their targets, allergies and diet preferences.
4) A one-line warm sign-off ending with "— BKN".
Use only the data provided; never invent records. Do not diagnose, do not give medical advice, do not recommend supplements or medication.`,
      contents: [{ role: "user", parts: [{ text: `THIS WEEK (last 7 days) AND EARLIER DATA (JSON):\n${JSON.stringify({ ...context, today_entries: undefined })}` }] }],
    });
    await recordUsage({ userId: auth.user.id, kind: "weekly_letter", model: settings.gemini_model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, latencyMs: out.latencyMs, settings });
    const { data, error } = await db.from("weekly_letters").upsert({ entry_date: today, content: out.text.slice(0, 6000) }, { onConflict: "user_id,entry_date" }).select("id, entry_date, content, created_at").single();
    if (error) throw new Error(error.message);
    return json({ letter: data });
  } catch (e) {
    const err = e as GeminiError;
    await recordUsage({ userId: auth.user.id, kind: "weekly_letter", model: settings.gemini_model, status: "error" });
    await logError("ai.weekly_letter", err.message ?? "unknown", { code: err.code }, auth.user.id);
    return json({ error: err.code === "timeout" ? "ai_timeout" : "ai_error" }, err.code === "timeout" ? 504 : 502);
  }
}
