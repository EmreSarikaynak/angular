import "server-only";
import { z } from "zod";
import { adminClient } from "./supabase/server";

export const settingsSchema = z.object({
  ai_enabled: z.boolean(),
  gemini_model: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  gemini_temperature: z.number().min(0).max(1),
  default_daily_ai_limit: z.number().int().min(0).max(10000),
  per_minute_limit: z.number().int().min(1).max(120),
  price_input_per_m: z.number().min(0).max(1000),
  price_output_per_m: z.number().min(0).max(1000),
  cache_ttl_days: z.number().int().min(0).max(365),
  announcement: z.string().max(300),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export function defaultSettings(): AppSettings {
  return {
    ai_enabled: true,
    gemini_model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    gemini_temperature: 0.2,
    default_daily_ai_limit: 40,
    per_minute_limit: 6,
    // USD / 1M belirteç. Yönetim panelinden güncel fiyat listesine göre düzenlenir.
    price_input_per_m: 0.75,
    price_output_per_m: 3.75,
    cache_ttl_days: 30,
    announcement: "",
  };
}

let cache: { at: number; value: AppSettings } | null = null;

export async function getSettings(force = false): Promise<AppSettings> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.value;
  const merged: Record<string, unknown> = { ...defaultSettings() };
  const { data } = await adminClient().from("app_settings").select("key, value");
  for (const row of data ?? []) {
    if (row.key in merged) merged[row.key] = row.value;
  }
  const parsed = settingsSchema.safeParse(merged);
  const value = parsed.success ? parsed.data : defaultSettings();
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(patch: Partial<AppSettings>, userId: string): Promise<AppSettings> {
  const next = settingsSchema.parse({ ...(await getSettings(true)), ...patch });
  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value: (next as Record<string, unknown>)[key] ?? value,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await adminClient().from("app_settings").upsert(rows);
    if (error) throw new Error(error.message);
  }
  cache = { at: Date.now(), value: next };
  return next;
}
