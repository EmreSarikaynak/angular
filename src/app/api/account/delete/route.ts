import { z } from "zod";
import { adminClient, authenticate, json, logError } from "@/lib/supabase/server";

const schema = z.object({ scope: z.enum(["photos", "account"]), confirm: z.literal(true) });

/** Kullanıcının depolama klasöründeki tüm fotoğrafları kalıcı olarak siler. */
async function removePhotos(userId: string): Promise<number> {
  const bucket = adminClient().storage.from("meal-photos");
  let removed = 0;
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 100 });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    const { error: delError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
    if (delError) throw new Error(delError.message);
    removed += data.length;
    if (data.length < 100) break;
  }
  return removed;
}

/**
 * KVKK/GDPR silme hakkı.
 * scope=photos  → yalnızca fotoğraflar silinir, kayıtlardaki fotoğraf bağlantıları temizlenir.
 * scope=account → fotoğraflar + hesap + tüm kişisel veriler (ON DELETE CASCADE) kalıcı olarak silinir.
 */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);

  try {
    const removed = await removePhotos(auth.user.id);
    if (parsed.data.scope === "photos") {
      await adminClient().from("food_entries").update({ photo_path: null }).eq("user_id", auth.user.id).not("photo_path", "is", null);
      return json({ ok: true, removed });
    }
    const { error } = await adminClient().auth.admin.deleteUser(auth.user.id);
    if (error) throw new Error(error.message);
    return json({ ok: true, removed });
  } catch (e) {
    await logError("account.delete", (e as Error).message, { scope: parsed.data.scope }, auth.user.id);
    return json({ error: "delete_failed" }, 500);
  }
}
