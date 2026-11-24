import { timingSafeEqual } from "node:crypto";
import { adminClient, json, logError } from "@/lib/supabase/server";
import { rowFromEvent, type RcEvent } from "@/lib/billing/revenuecat";

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** RevenueCat webhook'u: abonelik olaylarını subscriptions tablosuna yazar. Yetkilendirme: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>. */
export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) return json({ error: "not_configured" }, 503);
  const auth = req.headers.get("authorization") ?? "";
  if (!same(auth, `Bearer ${secret}`)) return json({ error: "unauthorized" }, 401);

  let event: RcEvent | undefined;
  try {
    event = ((await req.json()) as { event?: RcEvent }).event;
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!event) return json({ error: "bad_request" }, 400);

  const row = rowFromEvent(event);
  if (!row) return json({ ok: true, ignored: true });
  const { error } = await adminClient().from("subscriptions").upsert(row);
  if (error) {
    await logError("billing_webhook", error.message, { type: event.type }, row.user_id);
    return json({ error: "db_error" }, 500);
  }
  return json({ ok: true });
}
