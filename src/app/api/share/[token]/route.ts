import { createHash } from "node:crypto";
import { adminClient, json, serverConfigured } from "@/lib/supabase/server";
import { buildReport } from "@/lib/bkn/report";

/**
 * Paylaşım bağlantısının salt okunur verisi. Kimlik doğrulama yoktur; erişim, bağlantıdaki
 * 256 bitlik gizli belirteçle sağlanır. Süresi dolmuş ya da iptal edilmiş bağlantı 404 döner.
 * Yalnızca kullanıcının bağlantıyı oluştururken seçtiği bölümler gönderilir; soyad, e-posta,
 * doğum tarihi, fotoğraflar, notlar ve sohbet geçmişi hiçbir zaman paylaşılmaz.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[token]">) {
  const { token } = await ctx.params;
  if (!serverConfigured() || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return json({ error: "not_found" }, 404);
  const db = adminClient();
  const { data: link } = await db.from("share_links").select("*").eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at).getTime() < Date.now()) return json({ error: "not_found" }, 404);

  const report = await buildReport(link);
  if (!report) return json({ error: "not_found" }, 404);

  await db.from("share_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count ?? 0) + 1 }).eq("id", link.id);

  return json({ ...report, label: link.label, expires_at: link.expires_at }, 200, { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
}
