import { describe, expect, it } from "vitest";
import { isIsoDate, lapVerdict, onPaceShare } from "./dayview";

const lap = (paceS: number, d = 1000) => ({ distanceM: d, durationS: (paceS * d) / 1000 });

describe("day view lap judging", () => {
  it("judges steady runs against the plan range with 5 s grace", () => {
    expect(lapVerdict(lap(330), "easy", [320, 345])).toBe("ok");
    expect(lapVerdict(lap(316), "easy", [320, 345])).toBe("ok");
    expect(lapVerdict(lap(310), "easy", [320, 345])).toBe("fast");
    expect(lapVerdict(lap(352), "easy", [320, 345])).toBe("slow");
  });
  it("does not judge interval sessions, missing pace, or short laps", () => {
    expect(lapVerdict(lap(250), "intervals", [240, 250])).toBeNull();
    expect(lapVerdict(lap(330), "easy")).toBeNull();
    expect(lapVerdict(lap(330, 200), "easy", [320, 345])).toBeNull();
  });
  it("on-pace share is by distance", () => {
    expect(onPaceShare([lap(330), lap(330), lap(300), lap(330, 200)], "long", [320, 345])).toBe(67);
    expect(onPaceShare([lap(250)], "intervals", [240, 250])).toBeNull();
  });
  it("validates dates", () => {
    expect(isIsoDate("2026-11-02")).toBe(true);
    expect(isIsoDate("2026-13-40")).toBe(false);
    expect(isIsoDate("x")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
