import { describe, expect, it } from "vitest";
import { isActive, rowFromEvent } from "@/lib/billing/revenuecat";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = Date.UTC(2026, 10, 24);
const future = NOW + 30 * 86_400_000;

describe("rowFromEvent", () => {
  it("satın alma ve yenileme aktif olur", () => {
    const r = rowFromEvent({ type: "INITIAL_PURCHASE", app_user_id: ID, product_id: "bkny_premium_monthly", store: "PLAY_STORE", expiration_at_ms: future }, NOW);
    expect(r?.status).toBe("active");
    expect(r?.will_renew).toBe(true);
    expect(r?.period_end).toBe(new Date(future).toISOString());
  });
  it("iptal dönem sonuna kadar premium bırakır", () => {
    const r = rowFromEvent({ type: "CANCELLATION", app_user_id: ID, expiration_at_ms: future }, NOW)!;
    expect(r.status).toBe("cancelled");
    expect(r.will_renew).toBe(false);
    expect(isActive(r, NOW)).toBe(true);
  });
  it("süre dolunca premium biter", () => {
    const r = rowFromEvent({ type: "EXPIRATION", app_user_id: ID, expiration_at_ms: NOW - 1000 }, NOW)!;
    expect(r.status).toBe("expired");
    expect(isActive(r, NOW)).toBe(false);
  });
  it("anonim ya da geçersiz kimlikleri ve bilinmeyen olayları yok sayar", () => {
    expect(rowFromEvent({ type: "RENEWAL", app_user_id: "$RCAnonymousID:abc" }, NOW)).toBeNull();
    expect(rowFromEvent({ type: "TEST", app_user_id: ID }, NOW)).toBeNull();
    expect(rowFromEvent({ app_user_id: ID }, NOW)).toBeNull();
  });
  it("original_app_user_id yedek olarak kullanılır", () => {
    expect(rowFromEvent({ type: "RENEWAL", app_user_id: "$RCAnonymousID:x", original_app_user_id: ID, expiration_at_ms: future }, NOW)?.user_id).toBe(ID);
  });
});

describe("isActive", () => {
  it("satır yoksa false, dönem geçmişse false", () => {
    expect(isActive(null, NOW)).toBe(false);
    expect(isActive({ status: "active", period_end: new Date(NOW - 1).toISOString() }, NOW)).toBe(false);
    expect(isActive({ status: "billing_issue", period_end: new Date(future).toISOString() }, NOW)).toBe(true);
  });
});
