import { createHash } from "node:crypto";
import { analyzeRequestSchema, ANALYSIS_RESPONSE_SCHEMA } from "@/lib/ai/schemas";
import { cacheGet, cacheKey, cacheSet, guardAi, recordUsage } from "@/lib/ai/guard";
import { generate, GeminiError, parseJsonLoose } from "@/lib/ai/gemini";
import { labelPrompt, photoPrompt, textPrompt } from "@/lib/ai/prompts";
import { postProcessAnalysis } from "@/lib/ai/postprocess";
import { json, logError } from "@/lib/supabase/server";
import type { AnalysisResult } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;
  const usageKind = `analyze_${input.kind}`;

  const guard = await guardAi(req, usageKind);
  if (!guard.ok) return guard.response;
  const { auth, settings, quota } = guard;
  const model = settings.gemini_model;

  const imageHash = input.image ? createHash("sha256").update(input.image.data).digest("hex") : undefined;
  const key = cacheKey(["v2", input.kind, model, input.lang, input.text?.toLowerCase().replace(/\s+/g, " "), imageHash, input.hint?.toLowerCase()]);

  try {
    const cached = (await cacheGet(key, settings.cache_ttl_days)) as AnalysisResult | null;
    if (cached) {
      await recordUsage({ userId: auth.user.id, kind: usageKind, model, cached: true });
      return json({ result: { ...cached, cached: true }, quota });
    }

    const prompt =
      input.kind === "photo"
        ? photoPrompt(input.lang, input.hint)
        : input.kind === "label"
          ? labelPrompt(input.lang, input.hint)
          : textPrompt(input.lang, input.text ?? "", input.hint);

    const out = await generate({
      model,
      system: prompt.system,
      temperature: settings.gemini_temperature,
      responseSchema: ANALYSIS_RESPONSE_SCHEMA,
      contents: [
        {
          role: "user",
          parts: [...(input.image ? [{ inlineData: { mimeType: input.image.mimeType, data: input.image.data } }] : []), { text: prompt.user }],
        },
      ],
    });

    let result: AnalysisResult;
    try {
      result = postProcessAnalysis(parseJsonLoose(out.text), input.kind, input.lang);
    } catch {
      await recordUsage({ userId: auth.user.id, kind: usageKind, model, status: "error", inputTokens: out.inputTokens, outputTokens: out.outputTokens, latencyMs: out.latencyMs, settings });
      await logError("ai.analyze", "Model yanıtı şemaya uymuyor", { kind: input.kind, sample: out.text.slice(0, 300) }, auth.user.id);
      return json({ error: "invalid_ai_response" }, 502);
    }

    await Promise.all([
      recordUsage({ userId: auth.user.id, kind: usageKind, model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, latencyMs: out.latencyMs, settings }),
      cacheSet(key, input.kind, model, result),
    ]);
    return json({ result, quota: { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) } });
  } catch (e) {
    const err = e as GeminiError;
    await recordUsage({ userId: auth.user.id, kind: usageKind, model, status: "error" });
    await logError("ai.analyze", err.message ?? "unknown", { kind: input.kind, code: err.code, status: err.status }, auth.user.id);
    if (err.code === "timeout") return json({ error: "ai_timeout" }, 504);
    if (err.code === "quota") return json({ error: "ai_busy" }, 503);
    if (err.code === "blocked") return json({ error: "ai_blocked" }, 422);
    return json({ error: "ai_error" }, 502);
  }
}
