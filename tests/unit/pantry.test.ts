import { describe, expect, it } from "vitest";
import { daysLeft, mergeScan, normalizeName, pantryStatus, sortByUrgency, expiryDate } from "@/lib/bkn/pantry";
import type { PantryItem } from "@/lib/types";

const item = (o: Partial<PantryItem>): PantryItem => ({ id: "x", name: "süt", location: "fridge", added_on: "2026-11-20", expires_on: null, shelf_days: null, expiry_source: "estimate", ...o });

describe("envanter süre hesabı", () => {
  it("paketteki tarihi önceler, yoksa eklenme + saklama süresini kullanır", () => {
    expect(expiryDate(item({ expires_on: "2026-12-01", shelf_days: 3 }))).toBe("2026-12-01");
    expect(expiryDate(item({ shelf_days: 5 }))).toBe("2026-11-25");
    expect(expiryDate(item({}))).toBeNull();
  });
  it("kalan günü ve durumu doğru verir", () => {
    const today = "2026-11-23";
    expect(daysLeft(item({ shelf_days: 5 }), today)).toBe(2);
    expect(pantryStatus(item({ shelf_days: 5 }), today)).toBe("soon");
    expect(pantryStatus(item({ shelf_days: 2 }), today)).toBe("expired");
    expect(pantryStatus(item({ shelf_days: 3, added_on: "2026-11-20" }), "2026-11-23")).toBe("soon");
    expect(pantryStatus(item({ shelf_days: 60 }), today)).toBe("ok");
    expect(pantryStatus(item({}), today)).toBe("unknown");
    expect(pantryStatus(item({ expires_on: "2026-11-23" }), today)).toBe("soon");
  });
  it("en acilden başlayarak sıralar, tarihsizler sonda", () => {
    const list = [item({ name: "c" }), item({ name: "b", expires_on: "2026-12-10" }), item({ name: "a", expires_on: "2026-11-24" })];
    expect(sortByUrgency(list, "2026-11-23").map((i) => i.name)).toEqual(["a", "b", "c"]);
  });
  it("Türkçe harf farkını yok sayar", () => {
    expect(normalizeName("  IŞIK   Yoğurt ")).toBe(normalizeName("ışık yoğurt"));
  });
});

describe("tarama birleştirme", () => {
  const today = "2026-11-23";
  let n = 0;
  const id = () => `new${++n}`;
  it("yeni ürünleri ekler, aynı konumdaki aynı adı tekrar eklemez", () => {
    const existing = [item({ id: "e1", name: "Yumurta", shelf_days: 20 })];
    const r = mergeScan(existing, [{ name: "yumurta", expires_on: null, shelf_days: 25 }, { name: "Domates", expires_on: null, shelf_days: 5 }], "fridge", today, id);
    expect(r.add.map((a) => a.name)).toEqual(["Domates"]);
    expect(r.add[0]).toMatchObject({ location: "fridge", added_on: today, shelf_days: 5, expiry_source: "estimate" });
    expect(r.update).toEqual([]);
  });
  it("farklı konumda aynı ad ayrı ürün sayılır; kopyaları tek yapar", () => {
    const existing = [item({ id: "e1", name: "Tavuk", location: "fridge" })];
    const r = mergeScan(existing, [{ name: "Tavuk", expires_on: null, shelf_days: 120 }, { name: "tavuk", expires_on: null, shelf_days: 120 }], "freezer", today, id);
    expect(r.add).toHaveLength(1);
    expect(r.add[0].location).toBe("freezer");
  });
  it("paketten tarih okunursa tahmini tarihi günceller, kullanıcı tarihine dokunmaz", () => {
    const existing = [item({ id: "e1", name: "Süt", shelf_days: 5 }), item({ id: "e2", name: "Peynir", expires_on: "2026-12-30", expiry_source: "user" })];
    const r = mergeScan(existing, [{ name: "Süt", expires_on: "2026-11-27", shelf_days: null }, { name: "Peynir", expires_on: "2026-12-01", shelf_days: null }], "fridge", today, id);
    expect(r.update).toEqual([{ id: "e1", expires_on: "2026-11-27", shelf_days: 5, expiry_source: "label" }]);
  });
});
