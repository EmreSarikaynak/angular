import "server-only";
import { createHash } from "node:crypto";
import { adminClient, authenticate, json, type AuthContext } from "../supabase/server";
import { getSettings, type AppSettings } from "../settings";
import { geminiConfigured } from "./gemini";
import { isPremium } from "../billing/entitlement";

export interface Quota {
  limit: number;
  used: number;
  remaining: number;
}

export type GuardResult =
  | { ok: true; auth: AuthContext; settings: AppSettings; quota: Quota }
  | { ok: false; response: Response };

/**
 * Her yapay zekâ isteğinden önce çalışır:
 * kimlik doğrulama → engel kontrolü → dakikalık hız limiti → günlük kullanım limiti.
 * Sayaçlar veritabanındaki ai_usage tablosundan okunduğu için sunucusuz ortamda da tutarlıdır.
 */
export async function guardAi(req: Request, kind: string): Promise<GuardResult> {
  const auth = await authenticate(req);
  if (!auth) return { ok: false, response: json({ error: "unauthorized" }, 401) };

  const settings = await getSettings();
  if (!settings.ai_enabled) return { ok: false, response: json({ error: "ai_disabled" }, 503) };
  if (!geminiConfigured()) return { ok: false, response: json({ error: "ai_not_configured" }, 503) };

  const db = adminClient();
  const { data: lim } = await db.from("user_limits").select("daily_ai_limit, blocked").eq("user_id", auth.user.id).maybeSingle();
  if (lim?.blocked) return { ok: false, response: json({ error: "blocked" }, 403) };

  const now = Date.now();
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [minute, day] = await Promise.all([
    db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .gte("created_at", new Date(now - 60_000).toISOString()),
    db
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("status", "ok")
      .eq("cached", false)
      .gte("created_at", dayStart.toISOString()),
  ]);

  const premium = await isPremium(auth.user.id);
  const limit = lim?.daily_ai_limit ?? (premium ? settings.premium_daily_ai_limit : settings.default_daily_ai_limit);
  const used = day.count ?? 0;

  if ((minute.count ?? 0) >= settings.per_minute_limit) {
    await recordUsage({ userId: auth.user.id, kind, status: "rate_limited" });
    return { ok: false, response: json({ error: "rate_limited" }, 429, { "Retry-After": "60" }) };
  }
  if (used >= limit) {
    return { ok: false, response: json({ error: "daily_limit", limit, used, premium }, 429) };
  }
  return { ok: true, auth, settings, quota: { limit, used, remaining: Math.max(0, limit - used) } };
}

export interface UsageRecord {
  userId: string | null;
  kind: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cached?: boolean;
  status?: "ok" | "error" | "rate_limited";
  latencyMs?: number;
  settings?: AppSettings;
}

export function estimateCost(inputTokens: number, outputTokens: number, s: Pick<AppSettings, "price_input_per_m" | "price_output_per_m">): number {
  return (inputTokens * s.price_input_per_m + outputTokens * s.price_output_per_m) / 1_000_000;
}

export async function recordUsage(u: UsageRecord) {
  const cost = u.settings && !u.cached ? estimateCost(u.inputTokens ?? 0, u.outputTokens ?? 0, u.settings) : 0;
  await adminClient()
    .from("ai_usage")
    .insert({
      user_id: u.userId,
      kind: u.kind,
      model: u.model ?? null,
      input_tokens: u.cached ? 0 : (u.inputTokens ?? 0),
      output_tokens: u.cached ? 0 : (u.outputTokens ?? 0),
      cost_usd: cost,
      cached: !!u.cached,
      status: u.status ?? "ok",
      latency_ms: u.latencyMs ?? null,
    });
}

/** Önbellek anahtarı: istek içeriğinin özeti. Kullanıcı kimliği içermez, kişisel veri taşımaz. */
export function cacheKey(parts: (string | undefined)[]): string {
  const h = createHash("sha256");
  for (const p of parts) h.update(p ?? "").update("\u0000");
  return h.digest("hex");
}

export async function cacheGet(key: string, ttlDays: number): Promise<unknown | null> {
  if (ttlDays <= 0) return null;
  const db = adminClient();
  const { data } = await db.from("ai_cache").select("response, created_at, hits").eq("key", key).maybeSingle();
  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > ttlDays * 86_400_000) {
    await db.from("ai_cache").delete().eq("key", key);
    return null;
  }
  await db.from("ai_cache").update({ hits: (data.hits ?? 0) + 1 }).eq("key", key);
  return data.response;
}

export async function cacheSet(key: string, kind: string, model: string, response: unknown) {
  await adminClient().from("ai_cache").upsert({ key, kind, model, response, hits: 0, created_at: new Date().toISOString() });
}
