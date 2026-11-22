import { randomBytes } from "node:crypto";
import { z } from "zod";
import { adminClient, authenticate, json, logError, type AuthContext } from "@/lib/supabase/server";
import { makeJoinCode } from "@/lib/bkn/challenges";
import { localParts } from "@/lib/bkn/notify";
import { addDays } from "@/lib/dates";

const MAX_CLIENTS = 200;
const MAX_DIETITIANS_PER_CLIENT = 3;

/**
 * Diyetisyen paneli API'si.
 * - Diyetisyen yalnızca kendisine ETKİN bağlantısı olan danışanları görür.
 * - Danışan, bağlanırken açık rıza verir ve paylaşılacak bölümleri seçer; istediği an sonlandırır.
 * - Tablolar tarayıcıya kapalıdır; her işlemde ilişki burada doğrulanır.
 */
async function overview(auth: AuthContext) {
  const db = adminClient();
  const uid = auth.user.id;
  const { data: me } = await db.from("dietitians").select("display_name, title, invite_code").eq("user_id", uid).maybeSingle();

  // ── Diyetisyen olarak danışanlarım ────────────────────────────────────────
  let clients: unknown[] = [];
  if (me) {
    const { data: links } = await db.from("dietitian_clients").select("id, client_id, include_meals, include_body, include_wellbeing, consented_at").eq("dietitian_id", uid).is("ended_at", null).order("consented_at", { ascending: false });
    const ids = (links ?? []).map((l) => l.client_id);
    if (ids.length) {
      const today = localParts("Europe/Istanbul").date;
      const from = addDays(today, -6);
      const [{ data: profiles }, { data: food }, { data: notes }] = await Promise.all([
        db.from("profiles").select("id, first_name, last_name, kcal_target, goal").in("id", ids),
        db.from("food_entries").select("user_id, entry_date, kcal").in("user_id", ids).gte("entry_date", from).lte("entry_date", today).limit(20000),
        db.from("dietitian_notes").select("link_id, created_at").in("link_id", (links ?? []).map((l) => l.id)).order("created_at", { ascending: false }),
      ]);
      clients = (links ?? []).map((l) => {
        const p = profiles?.find((x) => x.id === l.client_id);
        const mine = (food ?? []).filter((f) => f.user_id === l.client_id);
        const days = new Map<string, number>();
        for (const f of mine) days.set(f.entry_date, (days.get(f.entry_date) ?? 0) + Number(f.kcal));
        const last = [...days.keys()].sort().at(-1) ?? null;
        const avgKcal = days.size ? Math.round([...days.values()].reduce((a, b) => a + b, 0) / days.size) : null;
        return {
          link_id: l.id,
          name: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "—",
          goal: p?.goal ?? null,
          since: l.consented_at,
          sections: { meals: l.include_meals, body: l.include_body, wellbeing: l.include_wellbeing },
          // Son 7 günün özeti (öğün ayrıntısı içermez).
          logged_days_7: days.size,
          last_log: last,
          avg_kcal_7: avgKcal,
          kcal_target: p?.kcal_target ?? null,
          last_note_at: notes?.find((n) => n.link_id === l.id)?.created_at ?? null,
        };
      });
    }
  }

  // ── Danışan olarak diyetisyenlerim ve bana bırakılan notlar ───────────────
  const { data: asClient } = await db.from("dietitian_clients").select("id, dietitian_id, include_meals, include_body, include_wellbeing, consented_at").eq("client_id", uid).is("ended_at", null);
  let dietitians: unknown[] = [];
  if (asClient?.length) {
    const [{ data: ds }, { data: notes }] = await Promise.all([
      db.from("dietitians").select("user_id, display_name, title").in("user_id", asClient.map((l) => l.dietitian_id)),
      db.from("dietitian_notes").select("id, link_id, content, created_at").in("link_id", asClient.map((l) => l.id)).eq("visible_to_client", true).order("created_at", { ascending: false }).limit(50),
    ]);
    dietitians = asClient.map((l) => {
      const d = ds?.find((x) => x.user_id === l.dietitian_id);
      return {
        link_id: l.id,
        name: d?.display_name ?? "—",
        title: d?.title ?? null,
        since: l.consented_at,
        sections: { meals: l.include_meals, body: l.include_body, wellbeing: l.include_wellbeing },
        notes: (notes ?? []).filter((n) => n.link_id === l.id).map((n) => ({ id: n.id, content: n.content, created_at: n.created_at })),
      };
    });
  }
  return { dietitian: me ?? null, clients, dietitians };
}

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  try {
    return json(await overview(auth));
  } catch (e) {
    await logError("dietitian", (e as Error).message, null, auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}

const sections = { include_meals: z.boolean(), include_body: z.boolean(), include_wellbeing: z.boolean() };
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable"), display_name: z.string().trim().min(2).max(80), title: z.string().trim().max(80).optional() }),
  z.object({ action: z.literal("connect"), code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8}$/), consent: z.literal(true), ...sections }),
  z.object({ action: z.literal("sections"), link_id: z.string().uuid(), ...sections }),
  z.object({ action: z.literal("end"), link_id: z.string().uuid() }),
  z.object({ action: z.literal("note"), link_id: z.string().uuid(), content: z.string().trim().min(1).max(2000), visible_to_client: z.boolean() }),
  z.object({ action: z.literal("note-delete"), id: z.string().uuid() }),
]);

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const input = parsed.data;
  const db = adminClient();
  const uid = auth.user.id;
  try {
    if (input.action === "enable") {
      const { data: existing } = await db.from("dietitians").select("invite_code").eq("user_id", uid).maybeSingle();
      const { error } = await db.from("dietitians").upsert({ user_id: uid, display_name: input.display_name, title: input.title || null, invite_code: existing?.invite_code ?? makeJoinCode(randomBytes(8)), updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }

    if (input.action === "connect") {
      const { data: d } = await db.from("dietitians").select("user_id").eq("invite_code", input.code).maybeSingle();
      if (!d) return json({ error: "dietitian_not_found" }, 404);
      if (d.user_id === uid) return json({ error: "cannot_connect_self" }, 400);
      const [{ count: mine }, { count: theirs }, { data: already }] = await Promise.all([
        db.from("dietitian_clients").select("id", { count: "exact", head: true }).eq("client_id", uid).is("ended_at", null),
        db.from("dietitian_clients").select("id", { count: "exact", head: true }).eq("dietitian_id", d.user_id).is("ended_at", null),
        db.from("dietitian_clients").select("id").eq("client_id", uid).eq("dietitian_id", d.user_id).is("ended_at", null).maybeSingle(),
      ]);
      if (already) return json({ error: "already_connected" }, 409);
      if ((mine ?? 0) >= MAX_DIETITIANS_PER_CLIENT) return json({ error: "too_many_dietitians" }, 409);
      if ((theirs ?? 0) >= MAX_CLIENTS) return json({ error: "dietitian_full" }, 409);
      const { error } = await db.from("dietitian_clients").insert({ dietitian_id: d.user_id, client_id: uid, include_meals: input.include_meals, include_body: input.include_body, include_wellbeing: input.include_wellbeing });
      if (error) throw new Error(error.message);
    }

    if (input.action === "sections") {
      // Yalnızca danışan kendi paylaşım kapsamını değiştirebilir.
      const { data, error } = await db.from("dietitian_clients").update({ include_meals: input.include_meals, include_body: input.include_body, include_wellbeing: input.include_wellbeing }).eq("id", input.link_id).eq("client_id", uid).is("ended_at", null).select("id");
      if (error) throw new Error(error.message);
      if (!data?.length) return json({ error: "not_found" }, 404);
    }

    if (input.action === "end") {
      const { data: link } = await db.from("dietitian_clients").select("id, dietitian_id, client_id").eq("id", input.link_id).is("ended_at", null).maybeSingle();
      if (!link || (link.client_id !== uid && link.dietitian_id !== uid)) return json({ error: "not_found" }, 404);
      await db.from("dietitian_clients").update({ ended_at: new Date().toISOString(), ended_by: link.client_id === uid ? "client" : "dietitian" }).eq("id", link.id);
      // Danışan ayrıldığında diyetisyenin onun hakkındaki notları da silinir (silme hakkı).
      if (link.client_id === uid) await db.from("dietitian_notes").delete().eq("link_id", link.id);
    }

    if (input.action === "note") {
      const { data: link } = await db.from("dietitian_clients").select("id").eq("id", input.link_id).eq("dietitian_id", uid).is("ended_at", null).maybeSingle();
      if (!link) return json({ error: "not_found" }, 404);
      const { error } = await db.from("dietitian_notes").insert({ link_id: link.id, author_id: uid, content: input.content, visible_to_client: input.visible_to_client });
      if (error) throw new Error(error.message);
    }

    if (input.action === "note-delete") {
      const { data } = await db.from("dietitian_notes").delete().eq("id", input.id).eq("author_id", uid).select("id");
      if (!data?.length) return json({ error: "not_found" }, 404);
    }
    return json(await overview(auth));
  } catch (e) {
    await logError("dietitian", (e as Error).message, { action: input.action }, uid);
    return json({ error: "server_error" }, 500);
  }
}
