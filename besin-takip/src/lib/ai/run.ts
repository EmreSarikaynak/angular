import "server-only";
import type { z } from "zod";
import { json, logError } from "../supabase/server";
import { cacheGet, cacheKey, cacheSet, guardAi, recordUsage } from "./guard";
import { generate, GeminiError, parseJsonLoose, type GeminiPart } from "./gemini";

/**
 * Yapılandırılmış JSON döndüren bir Gemini çağrısının ortak akışı:
 * limit kontrolü → önbellek → çağrı → şema doğrulama → kullanım kaydı.
 */
export async function runStructured<T>(
  req: Request,
  opts: {
    kind: string;
    system: string;
    parts: GeminiPart[];
    responseSchema: unknown;
    validate: z.ZodType<T>;
    /** Verilirse sonuç önbelleklenir. */
    cacheParts?: (string | undefined)[];
    temperature?: number;
  },
): Promise<Response> {
  const guard = await guardAi(req, opts.kind);
  if (!guard.ok) return guard.response;
  const { auth, settings, quota } = guard;
  const model = settings.gemini_model;
  const key = opts.cacheParts ? cacheKey(["v1", opts.kind, model, ...opts.cacheParts]) : null;
  try {
    if (key) {
      const cached = await cacheGet(key, settings.cache_ttl_days);
      if (cached) {
        await recordUsage({ userId: auth.user.id, kind: opts.kind, model, cached: true });
        return json({ result: cached, cached: true, quota });
      }
    }
    const out = await generate({ model, system: opts.system, temperature: opts.temperature ?? settings.gemini_temperature, responseSchema: opts.responseSchema, contents: [{ role: "user", parts: opts.parts }] });
    let parsed: ReturnType<typeof opts.validate.safeParse>;
    try {
      parsed = opts.validate.safeParse(parseJsonLoose(out.text));
    } catch {
      parsed = { success: false } as ReturnType<typeof opts.validate.safeParse>;
    }
    if (!parsed.success) {
      await recordUsage({ userId: auth.user.id, kind: opts.kind, model, status: "error", inputTokens: out.inputTokens, outputTokens: out.outputTokens, latencyMs: out.latencyMs, settings });
      await logError(`ai.${opts.kind}`, "Model yanıtı şemaya uymuyor", { sample: out.text.slice(0, 300) }, auth.user.id);
      return json({ error: "invalid_ai_response" }, 502);
    }
    await recordUsage({ userId: auth.user.id, kind: opts.kind, model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, latencyMs: out.latencyMs, settings });
    if (key) await cacheSet(key, opts.kind, model, parsed.data);
    return json({ result: parsed.data, quota: { ...quota, used: quota.used + 1, remaining: Math.max(0, quota.remaining - 1) } });
  } catch (e) {
    const err = e as GeminiError;
    await recordUsage({ userId: auth.user.id, kind: opts.kind, model, status: "error" });
    await logError(`ai.${opts.kind}`, err.message ?? "unknown", { code: err.code, status: err.status }, auth.user.id);
    if (err.code === "timeout") return json({ error: "ai_timeout" }, 504);
    if (err.code === "quota") return json({ error: "ai_busy" }, 503);
    if (err.code === "blocked") return json({ error: "ai_blocked" }, 422);
    return json({ error: "ai_error" }, 502);
  }
}
