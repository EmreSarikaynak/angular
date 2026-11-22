"use client";
import { supabase } from "../supabase/client";

const TABLES = ["food_entries", "water_logs", "activities", "daily_logs", "body_measurements", "favorites", "chat_messages", "supplements", "supplement_logs", "health_rings", "fasting_sessions", "meal_plans"] as const;

/** KVKK/GDPR veri taşınabilirliği: kullanıcının tüm verilerini tek bir JSON dosyasında toplar. */
export async function exportAllData(): Promise<Blob> {
  const db = supabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("unauthorized");
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: auth.user.id, email: auth.user.email, created_at: auth.user.created_at },
  };
  const { data: profile, error } = await db.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  out.profile = profile;
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const res = await db.from(table).select("*").order("created_at").order("id").range(offset, offset + 999);
      if (res.error) throw new Error(res.error.message);
      rows.push(...(res.data ?? []));
      if ((res.data ?? []).length < 1000) break;
    }
    out[table] = rows;
  }
  // Fotoğraflar: 24 saat geçerli indirme bağlantıları.
  const photos: { path: string; url: string | null }[] = [];
  const { data: files } = await db.storage.from("meal-photos").list(auth.user.id, { limit: 1000 });
  if (files?.length) {
    const paths = files.map((f) => `${auth.user!.id}/${f.name}`);
    const { data: signed } = await db.storage.from("meal-photos").createSignedUrls(paths, 86_400);
    for (const s of signed ?? []) photos.push({ path: s.path ?? "", url: s.signedUrl ?? null });
  }
  out.photos = photos;
  return new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
}
