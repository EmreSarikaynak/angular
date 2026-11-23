import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminClient, authenticate, json, logError, userClient, type AuthContext } from "@/lib/supabase/server";
import { challengeEnd, challengeProgress, makeJoinCode, type ChallengeMetric } from "@/lib/bkn/challenges";
import { localParts } from "@/lib/bkn/notify";
import { dayRows } from "@/lib/stats";
import type { Activity, DailyLog, FoodEntry, HealthRing, Profile, WaterLog } from "@/lib/types";

const MAX_MEMBERS = 20;
const MAX_ACTIVE = 5;

interface ChallengeRow {
  id: string;
  owner_id: string;
  title: string;
  metric: ChallengeMetric;
  days: number;
  start_date: string;
  join_code: string;
}

/** Çağıran kullanıcının ilerlemesini KENDİ kayıtlarından (RLS'li istemciyle) hesaplar. */
async function ownProgress(auth: AuthContext, c: ChallengeRow, profile: Profile | null, today: string): Promise<number> {
  const end = challengeEnd(c.start_date, c.days);
  const to = today < end ? today : end;
  if (to < c.start_date) return 0;
  const db = userClient(auth.token);
  const q = <T,>(table: string, cols: string) => db.from(table).select(cols).gte("entry_date", c.start_date).lte("entry_date", to).limit(5000) as unknown as PromiseLike<{ data: T[] | null }>;
  const [food, water, daily, rings] = await Promise.all([
    q<FoodEntry>("food_entries", "entry_date, meal, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, salt_g, alcohol_g"),
    q<WaterLog>("water_logs", "entry_date, amount_ml"),
    q<DailyLog>("daily_logs", "entry_date, steps"),
    q<HealthRing>("health_rings", "entry_date, move_kcal, steps"),
  ]);
  const rows = dayRows(c.start_date, to, { food: (food.data ?? []).map((f) => ({ ...f, kcal: Number(f.kcal), protein_g: Number(f.protein_g) })), water: water.data ?? [], activities: [] as Activity[], daily: daily.data ?? [], rings: rings.data ?? [] }, profile);
  return challengeProgress(c.metric, rows, profile);
}

async function listFor(auth: AuthContext) {
  const db = adminClient();
  const { data: profile } = await userClient(auth.token).from("profiles").select("*").maybeSingle();
  const p = profile as Profile | null;
  const today = localParts(p?.timezone ?? "Europe/Istanbul").date;
  const { data: mine } = await db.from("challenge_members").select("challenge_id").eq("user_id", auth.user.id);
  const ids = (mine ?? []).map((m) => m.challenge_id);
  if (!ids.length) return { challenges: [], today };
  const { data: challenges } = await db.from("challenges").select("*").in("id", ids).order("created_at", { ascending: false });

  // Kendi ilerlememi güncelle, sonra tüm üyelerin (yalnızca ad + gün sayısı) listesini oku.
  for (const c of (challenges ?? []) as ChallengeRow[]) {
    const progress = await ownProgress(auth, c, p, today);
    await db.from("challenge_members").update({ progress, updated_at: new Date().toISOString() }).eq("challenge_id", c.id).eq("user_id", auth.user.id);
  }
  const { data: members } = await db.from("challenge_members").select("challenge_id, user_id, display_name, progress").in("challenge_id", ids);
  return {
    today,
    challenges: ((challenges ?? []) as ChallengeRow[]).map((c) => {
      const end = challengeEnd(c.start_date, c.days);
      return {
        id: c.id,
        title: c.title,
        metric: c.metric,
        days: c.days,
        start_date: c.start_date,
        end_date: end,
        finished: today > end,
        join_code: c.join_code,
        is_owner: c.owner_id === auth.user.id,
        // Başka üyelerin kimliği (user_id, e-posta) istemciye gönderilmez.
        members: (members ?? [])
          .filter((m) => m.challenge_id === c.id)
          .map((m) => ({ name: m.display_name, progress: m.progress, me: m.user_id === auth.user.id }))
          .sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name)),
      };
    }),
  };
}

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  try {
    return json(await listFor(auth));
  } catch (e) {
    await logError("challenges", (e as Error).message, null, auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}

const name = z.string().trim().min(1).max(30);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), title: z.string().trim().min(1).max(80), metric: z.enum(["logging", "water", "protein", "steps"]), days: z.union([z.literal(7), z.literal(14), z.literal(30)]), display_name: name }),
  z.object({ action: z.literal("join"), code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8}$/), display_name: name }),
  z.object({ action: z.literal("leave"), id: z.string().uuid() }),
]);

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;
  const db = adminClient();
  try {
    if (input.action === "leave") {
      await db.from("challenge_members").delete().eq("challenge_id", input.id).eq("user_id", auth.user.id);
      const { count } = await db.from("challenge_members").select("user_id", { count: "exact", head: true }).eq("challenge_id", input.id);
      if (!count) await db.from("challenges").delete().eq("id", input.id);
      return json(await listFor(auth));
    }

    const { data: profile } = await userClient(auth.token).from("profiles").select("timezone").maybeSingle();
    const today = localParts(profile?.timezone ?? "Europe/Istanbul").date;
    const { data: mine } = await db.from("challenge_members").select("challenge_id, challenges(start_date, days)").eq("user_id", auth.user.id);
    const active = (mine ?? []).filter((m) => {
      const c = m.challenges as unknown as { start_date: string; days: number } | null;
      return c && challengeEnd(c.start_date, c.days) >= today;
    }).length;
    if (active >= MAX_ACTIVE) return json({ error: "too_many_challenges" }, 409);

    if (input.action === "create") {
      const { data: created, error } = await db.from("challenges").insert({ owner_id: auth.user.id, title: input.title, metric: input.metric, days: input.days, start_date: today, join_code: makeJoinCode(randomBytes(8)) }).select("id").single();
      if (error) throw new Error(error.message);
      await db.from("challenge_members").insert({ challenge_id: created.id, user_id: auth.user.id, display_name: input.display_name });
      return json(await listFor(auth));
    }

    const { data: c } = await db.from("challenges").select("id, start_date, days").eq("join_code", input.code).maybeSingle();
    if (!c || challengeEnd(c.start_date, c.days) < today) return json({ error: "challenge_not_found" }, 404);
    const { count } = await db.from("challenge_members").select("user_id", { count: "exact", head: true }).eq("challenge_id", c.id);
    if ((count ?? 0) >= MAX_MEMBERS) return json({ error: "challenge_full" }, 409);
    const { error } = await db.from("challenge_members").upsert({ challenge_id: c.id, user_id: auth.user.id, display_name: input.display_name }, { onConflict: "challenge_id,user_id" });
    if (error) throw new Error(error.message);
    return json(await listFor(auth));
  } catch (e) {
    await logError("challenges", (e as Error).message, { action: input.action }, auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}
