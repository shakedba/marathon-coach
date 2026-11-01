import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { extrasFor, strengthCaution, strengthFor } from "./extras";
import { toGarminStrength } from "./garmin/mappers";

const ids = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(from, i)).map((d) => [d, strengthFor(d)?.id ?? null] as const).filter(([, id]) => id);

describe("strength schedule (approved 1 Nov 2026)", () => {
  it("W16: Tue A (2 rounds) + Thu core/hips", () => {
    expect(ids("2026-11-02", 7)).toEqual([["2026-11-03", "A"], ["2026-11-05", "C"]]);
  });
  it("W17: Tue only, 1 round (last session, 10 days out)", () => {
    expect(ids("2026-11-09", 7)).toEqual([["2026-11-10", "A1"]]);
  });
  it("race week and first recovery week: none", () => {
    expect(ids("2026-11-16", 14)).toEqual([]);
  });
  it("recovery from 2nd week after Haifa: A Tue + Thu", () => {
    expect(ids("2026-11-30", 7)).toEqual([["2026-12-01", "A"], ["2026-12-03", "A"]]);
  });
  it("Tel Aviv build: Tue B + Thu C; plyo from January", () => {
    expect(ids("2026-12-07", 7)).toEqual([["2026-12-08", "B"], ["2026-12-10", "C"]]);
    expect(ids("2027-01-04", 7)).toEqual([["2027-01-05", "B+P"], ["2027-01-07", "C"]]);
  });
  it("cutback and taper weeks: one session", () => {
    expect(ids("2027-01-11", 7)).toEqual([["2027-01-12", "B+P"]]);
    expect(ids("2027-02-08", 7)).toEqual([["2027-02-09", "B+P"]]);
  });
  it("no strength in the last 10 days before Tel Aviv", () => {
    expect(ids("2027-02-17", 10)).toEqual([]);
    expect(strengthFor("2027-02-16")?.id).toBe("B+P"); // exactly 10 days out
  });
  it("phase 1 never includes squats or lunges", () => {
    for (const d of ["2026-11-03", "2026-11-05", "2026-11-10"]) {
      const names = strengthFor(d)!.exercises.map((e) => e.name.en.toLowerCase()).join(" ");
      expect(names).not.toMatch(/squat|lunge|step-up/);
    }
  });
});

describe("mobility", () => {
  it("after every run day, not on rest days before Haifa, not on race day", () => {
    expect(extrasFor("2026-11-02", {}).map((x) => x.kind)).toEqual(["mobility"]);
    expect(extrasFor("2026-11-03", {}).map((x) => x.kind)).toEqual(["strength", "mobility"]);
    expect(extrasFor("2026-11-08", {}).map((x) => x.kind)).toEqual([]);
    expect(extrasFor("2026-11-20", {})).toEqual([]);
    expect(extrasFor("2026-11-18", {})[0].minutes).toBe(5); // race week: light
  });
});

describe("caution after illness / niggle", () => {
  it("ill in the last 3 days -> skip strength; niggle -> no legs", () => {
    expect(strengthCaution([{ date: "2026-11-01", reason: "ill" }], "2026-11-03")?.en).toMatch(/skip strength/);
    expect(strengthCaution([{ date: "2026-11-02", reason: "niggle" }], "2026-11-03")?.en).toMatch(/no leg/);
    expect(strengthCaution([{ date: "2026-10-25", reason: "ill" }], "2026-11-03")).toBeNull();
  });
});

describe("toGarminStrength", () => {
  it("strength sport type, repeat group for rounds, one lap step per exercise", () => {
    const w = toGarminStrength(strengthFor("2026-11-03")!);
    expect(w.sportType.sportTypeKey).toBe("strength_training");
    const g = w.workoutSegments[0].workoutSteps[0];
    expect(g.type).toBe("RepeatGroupDTO");
    expect(g.numberOfIterations).toBe(2);
    expect(g.workoutSteps).toHaveLength(6);
    expect(g.workoutSteps[0].endCondition.conditionTypeKey).toBe("lap.button");
    expect(g.workoutSteps[0].description).toMatch(/Glute bridge/);
  });
});
