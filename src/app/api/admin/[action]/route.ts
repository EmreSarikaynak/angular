import { z } from "zod";
import { adminClient, authenticate, isAdmin, json, logError } from "@/lib/supabase/server";
import { getSettings, saveSettings, settingsSchema } from "@/lib/settings";
import { generate, geminiConfigured, GeminiError } from "@/lib/ai/gemini";
import { isOwner } from "@/lib/billing/entitlement";
import { isActive } from "@/lib/billing/revenuecat";
import { AI_FEATURES, APP_FEATURES, resolveFeature } from "@/lib/features";

type KindRow = { user_id: string; kind: string; calls: number; calls_today: number };
type CountRow = { user_id: string; foods: number; waters: number; activities: number; dailies: number; measurements: number; supplement_logs: number; fasting: number; plans: number; pantry: number };

/**
 * Yönetim API'si. Her istekte yönetici yetkisi sunucuda doğrulanır.
 * Bu uçlar kişisel sağlık kayıtlarını (öğünler, ölçümler, notlar, fotoğraflar) ASLA döndürmez;
 * yalnızca hesap bilgisi, kullanım sayaçları ve sistem verileri sunulur.
 */
async function requireAdmin(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return { error: json({ error: "unauthorized" }, 401) } as const;
  if (!(await isAdmin(auth.user))) return { error: json({ error: "forbidden" }, 403) } as const;
  return { auth } as const;
}

export async function GET(req: Request, ctx: RouteContext<"/api/admin/[action]">) {
  const { action } = await ctx.params;
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;
  const db = adminClient();

  try {
    if (action === "overview") {
      const [{ data: overview, error }, { data: daily }] = await Promise.all([db.rpc("admin_overview"), db.rpc("admin_usage_daily", { days: 30 })]);
      if (error) throw new Error(error.message);
      return json({ overview, daily: daily ?? [], gemini_configured: geminiConfigured() });
    }

    if (action === "users") {
      const url = new URL(req.url);
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 50 });
      if (error) throw new Error(error.message);
      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: limits }, { data: admins }, { data: usage }, subs, overrides, kindRows, countRows] = await Promise.all([
        db.from("profiles").select("id, first_name, last_name, onboarded_at, language").in("id", ids),
        db.from("user_limits").select("user_id, daily_ai_limit, blocked").in("user_id", ids),
        db.from("admins").select("user_id").in("user_id", ids),
        db.rpc("admin_usage_by_user", { days: 30 }),
        db.from("subscriptions").select("user_id, status, product_id, store, period_end, will_renew").in("user_id", ids),
        // Yeni sütun/fonksiyonlar migration ile gelir; henüz uygulanmadıysa liste yine de açılır.
        db.from("user_limits").select("user_id, premium_override, premium_note").in("user_id", ids),
        db.rpc("admin_usage_by_user_kind", { days: 30 }),
        db.rpc("admin_activity_counts"),
      ]);
      const kinds = (kindRows.data as KindRow[] | null) ?? [];
      const counts = (countRows.data as CountRow[] | null) ?? [];
      const users = list.users.map((u) => {
        const p = profiles?.find((x) => x.id === u.id);
        const l = limits?.find((x) => x.user_id === u.id);
        const us = (usage as { user_id: string; calls: number; calls_today: number; cost_usd: number }[] | null)?.find((x) => x.user_id === u.id);
        const sub = subs.data?.find((x) => x.user_id === u.id);
        const ov = overrides.data?.find((x) => x.user_id === u.id);
        const owner = isOwner(u.email);
        const subActive = isActive(sub ? { status: sub.status, period_end: sub.period_end } : null);
        const premium = owner || !!ov?.premium_override || subActive;
        const byKind: Record<string, { calls: number; today: number }> = {};
        for (const k of kinds) if (k.user_id === u.id) byKind[k.kind] = { calls: Number(k.calls), today: Number(k.calls_today) };
        const c = counts.find((x) => x.user_id === u.id);
        return {
          premium,
          premium_source: owner ? "owner" : ov?.premium_override ? "override" : subActive ? "subscription" : null,
          premium_note: ov?.premium_note ?? null,
          subscription: sub ? { status: sub.status, product_id: sub.product_id, store: sub.store, period_end: sub.period_end, will_renew: sub.will_renew } : null,
          by_kind: byKind,
          counts: c ? { foods: Number(c.foods), waters: Number(c.waters), activities: Number(c.activities), dailies: Number(c.dailies), measurements: Number(c.measurements), supplement_logs: Number(c.supplement_logs), fasting: Number(c.fasting), plans: Number(c.plans), pantry: Number(c.pantry) } : null,
          id: u.id,
          email: u.email,
          name: [p?.first_name, p?.last_name].filter(Boolean).join(" "),
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed: !!u.email_confirmed_at,
          onboarded: !!p?.onboarded_at,
          blocked: !!l?.blocked,
          daily_ai_limit: l?.daily_ai_limit ?? null,
          is_admin: !!admins?.find((a) => a.user_id === u.id),
          ai_calls_30d: Number(us?.calls ?? 0),
          ai_calls_today: Number(us?.calls_today ?? 0),
          ai_cost_30d: Number(us?.cost_usd ?? 0),
        };
      });
      return json({ users, page, has_more: list.users.length === 50, self_id: gate.auth.user.id });
    }

    if (action === "features") {
      const settings = await getSettings(true);
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { data: rows } = await db.from("ai_usage").select("kind, created_at").eq("status", "ok").eq("cached", false).gte("created_at", since).limit(50000);
      const [{ count: totalUsers }, { count: activeSubs }, { count: overrides }] = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("subscriptions").select("user_id", { count: "exact", head: true }).in("status", ["active", "cancelled", "billing_issue"]).gt("period_end", new Date().toISOString()),
        db.from("user_limits").select("user_id", { count: "exact", head: true }).eq("premium_override", true),
      ]);
      const catalog = AI_FEATURES.map((f) => {
        const mine = (rows ?? []).filter((r) => f.kinds.includes(r.kind));
        return {
          key: f.key,
          label: f.label,
          description: f.description,
          defaults: f.defaults,
          config: resolveFeature(f, settings.feature_config),
          usage: { today: mine.filter((r) => r.created_at >= dayStart.toISOString()).length, d30: mine.length },
        };
      });
      return json({
        catalog,
        app_features: APP_FEATURES,
        limits: { default_daily_ai_limit: settings.default_daily_ai_limit, premium_daily_ai_limit: settings.premium_daily_ai_limit },
        counts: { total_users: totalUsers ?? 0, subscribers: activeSubs ?? 0, comped: overrides ?? 0 },
      });
    }

    if (action === "settings") {
      return json({ settings: await getSettings(true), gemini_configured: geminiConfigured(), base_url_overridden: !!process.env.GEMINI_API_BASE_URL });
    }

    if (action === "usage") {
      const [{ data: daily }, { data: recent }, { data: byKind }] = await Promise.all([
        db.rpc("admin_usage_daily", { days: 30 }),
        db.from("ai_usage").select("id, user_id, kind, model, input_tokens, output_tokens, cost_usd, cached, status, latency_ms, created_at").order("created_at", { ascending: false }).limit(100),
        db.from("ai_usage").select("kind, cost_usd").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).limit(10000),
      ]);
      const kinds: Record<string, { calls: number; cost: number }> = {};
      for (const r of byKind ?? []) {
        kinds[r.kind] ??= { calls: 0, cost: 0 };
        kinds[r.kind].calls++;
        kinds[r.kind].cost += Number(r.cost_usd);
      }
      return json({ daily: daily ?? [], recent: recent ?? [], kinds });
    }

    if (action === "errors") {
      const { data } = await db.from("error_logs").select("id, user_id, source, message, detail, created_at").order("created_at", { ascending: false }).limit(200);
      return json({ errors: data ?? [] });
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    await logError("admin", (e as Error).message, { action }, gate.auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}

const userUpdateSchema = z.object({
  user_id: z.string().uuid(),
  blocked: z.boolean().optional(),
  daily_ai_limit: z.number().int().min(0).max(10000).nullable().optional(),
  is_admin: z.boolean().optional(),
  premium_override: z.boolean().optional(),
  premium_note: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/admin/[action]">) {
  const { action } = await ctx.params;
  const gate = await requireAdmin(req);
  if (gate.error) return gate.error;
  const db = adminClient();
  const body = await req.json().catch(() => ({}));

  try {
    if (action === "user-update") {
      const p = userUpdateSchema.safeParse(body);
      if (!p.success) return json({ error: "bad_request" }, 400);
      const { user_id, blocked, daily_ai_limit, is_admin, premium_override, premium_note } = p.data;
      if (blocked !== undefined || daily_ai_limit !== undefined) {
        const { data: cur } = await db.from("user_limits").select("daily_ai_limit, blocked").eq("user_id", user_id).maybeSingle();
        const { error } = await db.from("user_limits").upsert({
          user_id,
          blocked: blocked ?? cur?.blocked ?? false,
          daily_ai_limit: daily_ai_limit !== undefined ? daily_ai_limit : (cur?.daily_ai_limit ?? null),
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      }
      if (premium_override !== undefined || premium_note !== undefined) {
        // Yalnızca premium alanlarını günceller; diğer limit alanları korunur.
        const { data: cur } = await db.from("user_limits").select("user_id").eq("user_id", user_id).maybeSingle();
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (premium_override !== undefined) patch.premium_override = premium_override;
        if (premium_note !== undefined) patch.premium_note = premium_note;
        const r = cur ? await db.from("user_limits").update(patch).eq("user_id", user_id) : await db.from("user_limits").insert({ user_id, ...patch });
        if (r.error) throw new Error(r.error.message);
      }
      if (is_admin !== undefined) {
        if (!is_admin && user_id === gate.auth.user.id) return json({ error: "cannot_demote_self" }, 400);
        const r = is_admin ? await db.from("admins").upsert({ user_id }) : await db.from("admins").delete().eq("user_id", user_id);
        if (r.error) throw new Error(r.error.message);
      }
      return json({ ok: true });
    }

    if (action === "user-delete") {
      const p = z.object({ user_id: z.string().uuid() }).safeParse(body);
      if (!p.success) return json({ error: "bad_request" }, 400);
      if (p.data.user_id === gate.auth.user.id) return json({ error: "cannot_delete_self" }, 400);
      const bucket = db.storage.from("meal-photos");
      for (;;) {
        const { data } = await bucket.list(p.data.user_id, { limit: 100 });
        if (!data?.length) break;
        await bucket.remove(data.map((f) => `${p.data.user_id}/${f.name}`));
        if (data.length < 100) break;
      }
      const { error } = await db.auth.admin.deleteUser(p.data.user_id);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "settings") {
      const p = settingsSchema.partial().safeParse(body);
      if (!p.success) return json({ error: "bad_request", issues: p.error.issues.map((i) => i.path.join(".")) }, 400);
      return json({ settings: await saveSettings(p.data, gate.auth.user.id) });
    }

    if (action === "test-ai") {
      if (!geminiConfigured()) return json({ ok: false, error: "ai_not_configured" });
      const settings = await getSettings(true);
      try {
        const out = await generate({
          model: settings.gemini_model,
          system: "Reply with the single word: OK",
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          maxOutputTokens: 256,
          timeoutMs: 20_000,
        });
        return json({ ok: true, model: settings.gemini_model, latency_ms: out.latencyMs, reply: out.text.slice(0, 80) });
      } catch (e) {
        const err = e as GeminiError;
        return json({ ok: false, model: settings.gemini_model, error: err.code ?? "ai_error", detail: err.message?.slice(0, 300) });
      }
    }

    if (action === "errors-clear") {
      const { error } = await db.from("error_logs").delete().gt("id", 0);
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    if (action === "cache-clear") {
      const { error } = await db.from("ai_cache").delete().neq("key", "");
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    await logError("admin", (e as Error).message, { action }, gate.auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}
