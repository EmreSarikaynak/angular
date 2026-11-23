import { z } from "zod";
import { adminClient, authenticate, json, logError } from "@/lib/supabase/server";

const MAX_DEVICES_PER_USER = 10;
const body = z.object({ token: z.string().min(20).max(4096), platform: z.enum(["android", "ios"]) });

/** Mobil uygulama bu cihazın bildirim belirtecini kaydeder (aynı belirteç başka hesaptaysa devredilir). */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const db = adminClient();
  try {
    const { error } = await db.from("device_tokens").upsert({ token: parsed.data.token, platform: parsed.data.platform, user_id: auth.user.id, last_seen_at: new Date().toISOString() }, { onConflict: "token" });
    if (error) throw new Error(error.message);
    // Kullanıcı başına en fazla 10 cihaz: en eski kayıtlar silinir.
    const { data: all } = await db.from("device_tokens").select("id").eq("user_id", auth.user.id).order("last_seen_at", { ascending: false });
    const extra = (all ?? []).slice(MAX_DEVICES_PER_USER).map((d) => d.id);
    if (extra.length) await db.from("device_tokens").delete().in("id", extra);
    return json({ ok: true });
  } catch (e) {
    await logError("devices", (e as Error).message, null, auth.user.id);
    return json({ error: "server_error" }, 500);
  }
}

/** Çıkış yaparken ya da bildirimler kapatılırken belirteç silinir (yalnızca kendi belirteci). */
export async function DELETE(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const parsed = z.object({ token: z.string().min(20).max(4096) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  await adminClient().from("device_tokens").delete().eq("token", parsed.data.token).eq("user_id", auth.user.id);
  return json({ ok: true });
}
