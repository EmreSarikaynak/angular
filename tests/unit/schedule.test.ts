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

import { isQuiet, isValidTimeZone, utcOffsetLabel } from "@/lib/bkn/schedule";

describe("sessiz saatler ve saat dilimi", () => {
  const h = (hh: number, mm = 0) => toMinutes(hh, mm);
  it("22:00–08:00 gece yarısını aşan aralık", () => {
    expect(isQuiet(h(23), h(22), h(8))).toBe(true);
    expect(isQuiet(h(3), h(22), h(8))).toBe(true);
    expect(isQuiet(h(21, 59), h(22), h(8))).toBe(false);
    expect(isQuiet(h(8), h(22), h(8))).toBe(false);
    expect(isQuiet(h(12), h(22), h(8))).toBe(false);
  });
  it("gün içi aralık ve boş aralık", () => {
    expect(isQuiet(h(13), h(12), h(14))).toBe(true);
    expect(isQuiet(h(15), h(12), h(14))).toBe(false);
    expect(isQuiet(h(3), h(0), h(0))).toBe(false);
  });
  it("Ramazan: sahurdan önceki 90 dakika sessiz saatin dışında", () => {
    const sahur = h(4, 30);
    expect(isQuiet(h(3, 0), h(22), h(8), sahur)).toBe(false);
    expect(isQuiet(h(4, 29), h(22), h(8), sahur)).toBe(false);
    expect(isQuiet(h(2, 59), h(22), h(8), sahur)).toBe(true);
    expect(isQuiet(h(5), h(22), h(8), sahur)).toBe(true);
    expect(isQuiet(h(3, 0), h(22), h(8), null)).toBe(true);
  });
  it("saat dilimi doğrulama ve fark gösterimi", () => {
    expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(utcOffsetLabel("Europe/Istanbul", new Date("2026-11-24T12:00:00Z"))).toBe("UTC+3");
    expect(utcOffsetLabel("Asia/Kolkata", new Date("2026-11-24T12:00:00Z"))).toBe("UTC+5:30");
    expect(utcOffsetLabel("America/New_York", new Date("2026-11-24T12:00:00Z"))).toBe("UTC-5");
  });
});
