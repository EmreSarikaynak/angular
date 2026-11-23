import { describe, expect, it } from "vitest";
import { cycleAvailable } from "@/lib/bkn/cycle";

describe("döngü takibi kimde sunulur", () => {
  it("yalnızca kadın profillerinde", () => {
    expect(cycleAvailable("female")).toBe(true);
    expect(cycleAvailable("male")).toBe(false);
    expect(cycleAvailable(null)).toBe(false);
    expect(cycleAvailable(undefined)).toBe(false);
  });
});
