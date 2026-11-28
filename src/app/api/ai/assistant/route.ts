import { assistantRequestSchema } from "@/lib/ai/schemas";
import { guardAi, recordUsage } from "@/lib/ai/guard";
import { generate, GeminiError } from "@/lib/ai/gemini";
import { assistantSystemPrompt } from "@/lib/ai/prompts";
import { buildAssistantContext } from "@/lib/ai/context";
import { json, logError, userClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;

  const guard = await guardAi(req, "assistant");
  if (!guard.ok) return guard.response;
  const { auth, settings, quota } = guard;
  const model = settings.gemini_model;

  try {
    const db = userClient(auth.token);
    const context = await buildAssistantContext(db, input.today);

    const out = await generate({
      model,
      system: assistantSystemPrompt(input.lang),
      temperature: Math.max(0.3, settings.gemini_temperature),
      maxOutputTokens: 1500,
      contents: [
        { role: "user", parts: [{ text: `USER DATA (JSON):\n${JSON.stringify(context)}` }] },
        { role: "model", parts: [{ text: "OK" }] },
        ...input.history.map((m) => ({ role: m.role === "assistant" ? ("model" as const) : ("user" as const), parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: input.message }] },
      ],
    });

    await recordUsage({ userId: auth.user.id, kind: "assistant", model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, latencyMs: out.latencyMs, settings });
    const now = Date.now();
    await db.from("chat_messages").insert([
      { role: "user", content: input.message, created_at: new Date(now - 1).toISOString() },
      { role: "assistant", content: out.text.slice(0, 8000), created_at: new Date(now).toISOString() },
    ]);
    return json({ reply: out.text, quota: { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) } });
  } catch (e) {
    const err = e as GeminiError;
    await recordUsage({ userId: auth.user.id, kind: "assistant", model, status: "error" });
    await logError("ai.assistant", err.message ?? "unknown", { code: err.code, status: err.status }, auth.user.id);
    if (err.code === "timeout") return json({ error: "ai_timeout" }, 504);
    if (err.code === "quota") return json({ error: "ai_busy" }, 503);
    if (err.code === "billing") return json({ error: "ai_unavailable" }, 503);
    if (err.code === "blocked") return json({ error: "ai_blocked" }, 422);
    return json({ error: "ai_error" }, 502);
  }
}
