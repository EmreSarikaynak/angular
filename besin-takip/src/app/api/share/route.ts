import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { authenticate, json, userClient } from "@/lib/supabase/server";

const request = z.object({
  label: z.string().trim().max(80).optional(),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
  valid_days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
  include_meals: z.boolean(),
  include_body: z.boolean(),
  include_wellbeing: z.boolean(),
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Salt okunur paylaşım bağlantısı oluşturur. Gizli belirteç yalnızca bu yanıtta döner;
 * veritabanında özeti saklanır, bu yüzden bağlantı sonradan yeniden gösterilemez.
 */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const parsed = request.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const db = userClient(auth.token);
  const { count } = await db.from("share_links").select("id", { count: "exact", head: true }).is("revoked_at", null).gt("expires_at", new Date().toISOString());
  if ((count ?? 0) >= 5) return json({ error: "too_many_links" }, 409);

  const token = randomBytes(32).toString("base64url");
  const { valid_days, label, ...rest } = parsed.data;
  const { data, error } = await db
    .from("share_links")
    .insert({ ...rest, label: label || null, token_hash: hashToken(token), expires_at: new Date(Date.now() + valid_days * 86_400_000).toISOString() })
    .select("id, expires_at")
    .single();
  if (error) return json({ error: "server_error" }, 500);
  return json({ id: data.id, token, expires_at: data.expires_at });
}
