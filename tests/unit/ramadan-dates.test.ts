import { describe, expect, it } from "vitest";
import { activeRamadan, ramadanEnded, RAMADAN_PERIODS } from "@/lib/bkn/ramadan-dates";
import { ramadanProgram } from "@/lib/bkn/ramadan";

describe("Ramazan takvimi", () => {
  it("önümüzdeki 10 yılı kapsar ve sıralıdır", () => {
    expect(RAMADAN_PERIODS.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < RAMADAN_PERIODS.length; i++) expect(RAMADAN_PERIODS[i].start > RAMADAN_PERIODS[i - 1].end).toBe(true);
    for (const p of RAMADAN_PERIODS) expect(p.end > p.start).toBe(true);
    expect(RAMADAN_PERIODS.at(-1)!.end >= "2036-01-01").toBe(true);
  });
  it("Ramazan'dan 3 gün önce başlar, son günde biter, dışında null", () => {
    expect(activeRamadan("2027-02-04")).toBeNull();
    expect(activeRamadan("2027-02-05")?.start).toBe("2027-02-08");
    expect(activeRamadan("2027-03-08")?.start).toBe("2027-02-08");
    expect(activeRamadan("2027-03-09")).toBeNull();
    expect(activeRamadan("2026-12-01")).toBeNull();
  });
  it("yıl içinde iki Ramazan olan 2030'u ayırır", () => {
    expect(activeRamadan("2030-01-10")?.start).toBe("2030-01-05");
    expect(activeRamadan("2030-12-28")?.start).toBe("2030-12-26");
    expect(activeRamadan("2030-06-01")).toBeNull();
  });
  it("bitmiş Ramazan'ı tanır", () => {
    expect(ramadanEnded("2027-02-08", "2027-03-08")).toBe(false);
    expect(ramadanEnded("2027-02-08", "2027-03-09")).toBe(true);
    expect(ramadanEnded("1999-01-01", "2027-03-09")).toBe(false);
  });
});

describe("Ramazan programı", () => {
  it("proteini ve kaloriyi üç öğüne böler, saatleri koyar", () => {
    const [iftar, snack, sahur] = ramadanProgram(2000, 120, "19:00", "04:30");
    expect(iftar).toMatchObject({ key: "iftar", time: "19:00", kcal: 800, protein_g: 40 });
    expect(snack).toMatchObject({ key: "snack", time: "21:00", kcal: 400, protein_g: 30 });
    expect(sahur).toMatchObject({ key: "sahur", time: "03:45", kcal: 800, protein_g: 50 });
    expect(iftar.protein_g + snack.protein_g + sahur.protein_g).toBe(120);
  });
});
