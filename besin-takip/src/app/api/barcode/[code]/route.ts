import { authenticate, json, logError } from "@/lib/supabase/server";
import { cacheGet, cacheSet } from "@/lib/ai/guard";
import type { FoodItem } from "@/lib/types";

const n = (v: unknown) => {
  const x = Number(v);
  return isFinite(x) && x > 0 ? x : 0;
};

/** Barkoddan ürün arama: Open Food Facts (açık veri, ODbL). Sonuçlar 30 gün önbelleklenir. */
export async function GET(req: Request, ctx: RouteContext<"/api/barcode/[code]">) {
  const auth = await authenticate(req);
  if (!auth) return json({ error: "unauthorized" }, 401);

  const { code } = await ctx.params;
  if (!/^\d{8,14}$/.test(code)) return json({ error: "bad_barcode" }, 400);

  const key = `barcode:${code}`;
  const cached = await cacheGet(key, 30);
  if (cached) return json({ product: cached, cached: true });

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_tr,brands,serving_quantity,serving_size,quantity,nutriments`,
      { headers: { "User-Agent": "BesinTakip/1.0 (nutrition tracker)" }, signal: AbortSignal.timeout(10_000) },
    );
    if (res.status === 404) return json({ error: "not_found" }, 404);
    if (!res.ok) throw new Error(`OFF HTTP ${res.status}`);
    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (data.status !== 1 || !data.product) return json({ error: "not_found" }, 404);

    const p = data.product;
    const nu = (p.nutriments ?? {}) as Record<string, unknown>;
    const kcal100 = n(nu["energy-kcal_100g"]) || n(nu["energy_100g"]) / 4.184;
    if (!kcal100 && !n(nu["proteins_100g"]) && !n(nu["carbohydrates_100g"]) && !n(nu["fat_100g"])) {
      return json({ error: "no_nutrition" }, 404);
    }
    const name = [p.brands, p.product_name_tr || p.product_name].filter(Boolean).join(" ").trim() || code;
    const per100: FoodItem = {
      name: String(name).slice(0, 200),
      quantity: 100,
      unit: "g",
      grams: 100,
      kcal: Math.round(kcal100),
      protein_g: n(nu["proteins_100g"]),
      carbs_g: n(nu["carbohydrates_100g"]),
      fat_g: n(nu["fat_100g"]),
      sugar_g: n(nu["sugars_100g"]),
      fiber_g: n(nu["fiber_100g"]),
      salt_g: n(nu["salt_100g"]) || n(nu["sodium_100g"]) * 2.5,
      alcohol_g: 0,
      confidence: 1,
      is_estimated: false,
      data_source: "openfoodfacts",
    };
    const product = { code, per100, serving_g: n(p.serving_quantity) || null, serving_label: p.serving_size ? String(p.serving_size) : null };
    await cacheSet(key, "barcode", "openfoodfacts", product);
    return json({ product });
  } catch (e) {
    await logError("barcode", (e as Error).message, { code }, auth.user.id);
    return json({ error: "lookup_failed" }, 502);
  }
}
