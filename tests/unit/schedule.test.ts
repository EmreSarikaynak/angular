import { describe, expect, it } from "vitest";
import { formatHHMM, inDailyWindow, inWindowFrom, parseHHMM, quarterTimes, toMinutes } from "@/lib/bkn/schedule";

describe("15 dakikalık zamanlama", () => {
  it("seçenekler 00:00–23:45 arası 96 adımdır", () => {
    const q = quarterTimes();
    expect(q).toHaveLength(96);
    expect(q[0]).toBe("00:00");
    expect(q[1]).toBe("00:15");
    expect(q[77]).toBe("19:15");
    expect(q.at(-1)).toBe("23:45");
  });
  it("saat dönüşümleri", () => {
    expect(parseHHMM("19:15")).toBe(1155);
    expect(formatHHMM(1155)).toBe("19:15");
    expect(toMinutes(19, 15)).toBe(1155);
    expect(formatHHMM(-15)).toBe("23:45");
  });
  it("günlük pencere gece yarısını aşabilir", () => {
    expect(inDailyWindow(toMinutes(10), toMinutes(9, 15), toMinutes(21, 30))).toBe(true);
    expect(inDailyWindow(toMinutes(9, 14), toMinutes(9, 15), toMinutes(21, 30))).toBe(false);
    expect(inDailyWindow(toMinutes(21, 30), toMinutes(9, 15), toMinutes(21, 30))).toBe(false);
    expect(inDailyWindow(toMinutes(23), toMinutes(22), toMinutes(6))).toBe(true);
    expect(inDailyWindow(toMinutes(3), toMinutes(22), toMinutes(6))).toBe(true);
    expect(inDailyWindow(toMinutes(12), toMinutes(22), toMinutes(6))).toBe(false);
  });
  it("başlangıçtan itibaren pencere: 19:15'te bildirim 19:15'ten önce çıkmaz", () => {
    const start = toMinutes(19, 15);
    expect(inWindowFrom(toMinutes(19, 0), start, 60)).toBe(false);
    expect(inWindowFrom(toMinutes(19, 15), start, 60)).toBe(true);
    expect(inWindowFrom(toMinutes(20, 14), start, 60)).toBe(true);
    expect(inWindowFrom(toMinutes(20, 15), start, 60)).toBe(false);
    expect(inWindowFrom(toMinutes(0, 10), toMinutes(23, 45), 60)).toBe(true);
  });
});
