import { describe, expect, it } from "vitest";
import { isHidden, orderItems, sanitizePrefs, visibleItems } from "@/lib/layout-prefs";

const items = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("liste tercihleri", () => {
  it("tercih yoksa varsayılan sırayı korur", () => {
    expect(orderItems(items).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
    expect(orderItems(items, { order: [], hidden: [] }).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("kullanıcının sırasını uygular, bilinmeyen kimlikleri yok sayar, yeni öğeleri sona ekler", () => {
    const pref = { order: ["c", "zzz", "a"], hidden: [] };
    expect(orderItems(items, pref).map((i) => i.id)).toEqual(["c", "a", "b", "d"]);
  });
  it("gizlenenleri çıkarır", () => {
    const pref = { order: ["d", "c", "b", "a"], hidden: ["c", "a"] };
    expect(isHidden(pref, "c")).toBe(true);
    expect(visibleItems(items, pref).map((i) => i.id)).toEqual(["d", "b"]);
  });
  it("tüm öğeler gizlense de liste bozulmaz", () => {
    expect(visibleItems(items, { order: [], hidden: ["a", "b", "c", "d"] })).toEqual([]);
  });
  it("güvenilmeyen girdiyi temizler", () => {
    expect(sanitizePrefs(null)).toEqual({});
    expect(sanitizePrefs([1, 2])).toEqual({});
    expect(sanitizePrefs({ x: { order: ["a", 5, "b"], hidden: "no" }, y: 3 })).toEqual({ x: { order: ["a", "b"], hidden: [] } });
  });
});
