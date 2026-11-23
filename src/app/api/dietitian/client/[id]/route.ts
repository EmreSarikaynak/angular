import { adminClient, authenticate, json, logError } from "@/lib/supabase/server";
import { buildReport } from "@/lib/bkn/report";

/**
 * Bir danışanın ayrıntılı raporu. Yalnızca o danışanla ETKİN bağlantısı olan diyetisyen erişebilir;
 * rapor, danışanın izin verdiği bölümlerle sınırlıdır.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/dietitian/client/[id]">) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "not_found" }, 404);
  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;
  const db = adminClient();
  try {
    const { data: link } = await db.from("dietitian_clients").select("id, client_id, include_meals, include_body, include_wellbeing, consented_at").eq("id", id).eq("dietitian_id", auth.user.id).is("ended_at", null).maybeSingle();
    if (!link) return json({ error: "not_found" }, 404);
    const [report, { data: profile }, { data: notes }] = await Promise.all([
      buildReport({ user_id: link.client_id, days, include_meals: link.include_meals, include_body: link.include_body, include_wellbeing: link.include_wellbeing }),
      db.from("profiles").select("last_name").eq("id", link.client_id).maybeSingle(),
      db.from("dietitian_notes").select("id, content, visible_to_client, created_at").eq("link_id", link.id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (!report) return json({ error: "not_found" }, 404);
    return json({ report: { ...report, last_name: profile?.last_name ?? null }, notes: notes ?? [], since: link.consented_at, days });
  } catch (e) {
    await logError("dietitian.client", (e as Error).message, null, auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}
