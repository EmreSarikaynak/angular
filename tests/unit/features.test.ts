import { describe, expect, it } from "vitest";
import { AI_FEATURES, checkFeature, featureForKind, resolveFeature } from "@/lib/features";

const photo = AI_FEATURES.find((f) => f.key === "food_photo")!;

describe("özellik planları", () => {
  it("kind → özellik eşlemesi (fridge iki türü kapsar)", () => {
    expect(featureForKind("analyze_photo")?.key).toBe("food_photo");
    expect(featureForKind("fridge_scan")?.key).toBe("fridge");
    expect(featureForKind("fridge")?.key).toBe("fridge");
    expect(featureForKind("bilinmeyen")).toBeUndefined();
  });
  it("ayar yoksa varsayılanlar (tanıtım metinleriyle aynı sayılar)", () => {
    const c = resolveFeature(photo, {});
    expect(c).toEqual({ tier: "free", free: 5, premium: 100 });
    expect(checkFeature(c, false, 4).ok).toBe(true);
    expect(checkFeature(c, false, 5).ok).toBe(false);
    expect(checkFeature(c, true, 99).ok).toBe(true);
    const plan = resolveFeature(AI_FEATURES.find((x) => x.key === "meal_plan")!, {});
    expect(checkFeature(plan, false, 0)).toEqual({ ok: false, reason: "premium_required", limit: 0 });
  });
  it("yönetici ayarı varsayılanı ezer, boş (null) sınırsız demektir", () => {
    const c = resolveFeature(photo, { food_photo: { tier: "free", free: 3, premium: null } });
    expect(c.free).toBe(3);
    expect(c.premium).toBeNull();
    expect(checkFeature(c, false, 2).ok).toBe(true);
    expect(checkFeature(c, false, 3)).toEqual({ ok: false, reason: "feature_limit", limit: 3 });
    expect(checkFeature(c, true, 500).ok).toBe(true);
  });
  it("premium'a özel özellik ücretsiz kullanıcıya kapalıdır", () => {
    const c = resolveFeature(photo, { food_photo: { tier: "premium", free: 100, premium: 50 } });
    expect(checkFeature(c, false, 0)).toEqual({ ok: false, reason: "premium_required", limit: 0 });
    expect(checkFeature(c, true, 49).ok).toBe(true);
    expect(checkFeature(c, true, 50)).toEqual({ ok: false, reason: "feature_limit", limit: 50 });
  });
  it("0 limiti özelliği kapatır; geçersiz değerler varsayılana düşer", () => {
    const c = resolveFeature(photo, { food_photo: { tier: "free", free: 0, premium: -5 } });
    expect(checkFeature(c, false, 0).ok).toBe(false);
    expect(c.premium).toBe(100);
  });
});
