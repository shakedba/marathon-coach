import { describe, expect, it } from "vitest";
import { toGarminWorkout } from "./mappers";
import { planFor } from "../plan";

describe("toGarminWorkout", () => {
  it("builds warm-up / repeat / cool-down for hills", () => {
    const w = toGarminWorkout(planFor("2026-11-03", {}));
    const steps = w.workoutSegments[0].workoutSteps;
    expect(steps.map((s: any) => s.type)).toEqual(["ExecutableStepDTO", "RepeatGroupDTO", "ExecutableStepDTO"]);
    expect(steps[1].numberOfIterations).toBe(5);
    expect(steps[0].endConditionValue).toBe(2000);
  });
  it("puts the HR cap in the step description and pace as m/s range", () => {
    const w = toGarminWorkout(planFor("2026-11-04", {}));
    const mp = w.workoutSegments[0].workoutSteps[1];
    expect(mp.description).toBe("HR <= 160");
    expect(mp.targetValueOne).toBeLessThan(mp.targetValueTwo);
    expect(mp.targetValueTwo).toBeCloseTo(1000 / 307, 3);
  });
});
