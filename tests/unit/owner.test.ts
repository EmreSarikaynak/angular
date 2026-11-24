import { describe, expect, it } from "vitest";
import { isListedEmail, parseEmailList } from "@/lib/billing/owner";

describe("kurucu e-posta listesi", () => {
  it("virgül, boşluk ve noktalı virgülle ayrılmış listeyi çözer", () => {
    expect(parseEmailList(" A@x.com, b@y.com;c@z.com  ")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(parseEmailList(undefined)).toEqual([]);
  });
  it("büyük/küçük harf duyarsız eşleşir", () => {
    expect(isListedEmail("Damla@Gmail.com", "damla@gmail.com")).toBe(true);
    expect(isListedEmail("baska@gmail.com", "damla@gmail.com")).toBe(false);
    expect(isListedEmail(null, "damla@gmail.com")).toBe(false);
    expect(isListedEmail("a@b.com", "")).toBe(false);
  });
});
