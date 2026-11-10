import { describe, expect, it } from "vitest";
import { isIsoDate } from "./dayview";

describe("isIsoDate", () => {
  it("validates dates", () => {
    expect(isIsoDate("2026-11-02")).toBe(true);
    expect(isIsoDate("2026-13-40")).toBe(false);
    expect(isIsoDate("x")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
