import { describe, expect, it } from "vitest";
import { productNotes, splitIngredients, notesDisclaimer } from "@/lib/bkn/product-notes";

const codes = (n: ReturnType<typeof productNotes>) => n.map((x) => x.code);

describe("productNotes", () => {
  it("palm yağını nötr dille işaretler", () => {
    const n = productNotes({ ingredients_text: "Şeker, bitkisel yağ (palm yağı), kakao" }, "tr");
    const palm = n.find((x) => x.code === "palm_oil");
    expect(palm?.level).toBe("caution");
    expect(palm?.text).not.toMatch(/sağlıksız|tüketilmemeli|zararlı/i);
  });
  it("şekersiz ürüne eklenmiş şeker notu vermez", () => {
    expect(codes(productNotes({ ingredients_text: "Su, şekersiz kakao" }, "tr"))).not.toContain("added_sugar");
  });
  it("kullanıcı alerjisini bulur, bitkisel sütü süt saymaz", () => {
    const a = productNotes({ ingredients_text: "Su, badem sütü", userAllergies: ["lactose"] }, "tr");
    expect(codes(a)).not.toContain("allergy:lactose");
    const b = productNotes({ ingredients_text: "Süt tozu, kakao", userAllergies: ["lactose"] }, "tr");
    expect(b[0].level).toBe("allergy");
  });
  it("iz miktarda ifadesini ayrı not yapar", () => {
    const n = productNotes({ ingredients_text: "Un. Eser miktarda fındık içerebilir.", userAllergies: ["tree_nuts"] }, "tr");
    expect(codes(n)).toContain("trace:tree_nuts");
  });
  it("E numaralarını yakalar", () => {
    const n = productNotes({ ingredients_text: "Et, koruyucu (E250), boya E102" }, "en");
    expect(codes(n)).toEqual(expect.arrayContaining(["nitrites", "azo_colors"]));
  });
  it("besin eşikleri ve sıvı yarı eşik", () => {
    const per = { kcal: 100, protein_g: 1, fat_g: 1, sat_fat_g: 0, sugar_g: 12, fiber_g: 0, salt_g: 0.1 };
    expect(codes(productNotes({ per100: per }, "tr"))).not.toContain("sugar_high");
    expect(codes(productNotes({ per100: per, liquid: true }, "tr"))).toContain("sugar_high");
  });
  it("olumlu notlar: lif ve protein", () => {
    const n = productNotes({ per100: { kcal: 300, protein_g: 20, fat_g: 5, sugar_g: 2, fiber_g: 7, salt_g: 0.2 } }, "tr");
    expect(codes(n)).toEqual(expect.arrayContaining(["fiber_high", "protein_high", "salt_low", "sugar_low"]));
  });
  it("sıralama alerji önce, olumlu sonda", () => {
    const n = productNotes({ ingredients_text: "tam buğday unu, palm yağı, süt", userAllergies: ["lactose"] }, "tr");
    expect(n[0].level).toBe("allergy");
    expect(n[n.length - 1].level).toBe("benefit");
  });
  it("splitIngredients parantezi bölmez", () => {
    expect(splitIngredients("a, b (c, d), e")).toEqual(["a", "b (c, d)", "e"]);
  });
  it("çekince metni var", () => {
    expect(notesDisclaimer("tr")).toMatch(/tıbbi tavsiye değildir/);
  });
});
