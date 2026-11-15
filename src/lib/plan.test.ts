import { describe, expect, it } from "vitest";
import { isRaceDay, planFor } from "./plan";

describe("isRaceDay", () => {
  it("is true only on race dates", () => {
    expect(isRaceDay("2026-11-20")).toBe(true);
    expect(isRaceDay("2027-02-26")).toBe(true);
    expect(isRaceDay("2026-11-19")).toBe(false);
    expect(isRaceDay("2026-11-21")).toBe(false);
  });

  it("the plan still shows the marathon on race day (only the Garmin push skips it)", () => {
    expect(planFor("2026-11-20", {}).type).toBe("race");
  });
});
