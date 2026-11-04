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
    const w = toGarminWorkout(planFor("2026-11-10", {}));
    const mp = w.workoutSegments[0].workoutSteps[1];
    expect(mp.description).toBe("HR <= 160");
    expect(mp.targetValueOne).toBeLessThan(mp.targetValueTwo);
    expect(mp.targetValueTwo).toBeCloseTo(1000 / 307, 3);
  });
});

describe("Garmin load mapping", () => {
  it("keeps only derived training-status numbers, primary device first", async () => {
    const { mapTrainingStatus, mapActivity } = await import("./mappers");
    const res = {
      mostRecentTrainingStatus: {
        latestTrainingStatusData: {
          "111": { primaryTrainingDevice: false, trainingStatusFeedbackPhrase: "RECOVERY_1", acuteTrainingLoadDTO: { dailyTrainingLoadAcute: 1 } },
          "222": {
            primaryTrainingDevice: true,
            trainingStatusFeedbackPhrase: "PEAKING_2",
            acuteTrainingLoadDTO: { dailyTrainingLoadAcute: 512.4, dailyTrainingLoadChronic: 701.26, dailyAcuteChronicWorkloadRatio: 0.73 },
          },
        },
      },
    };
    expect(mapTrainingStatus(res)).toEqual({ acuteLoad: 512.4, chronicLoad: 701.3, loadRatio: 0.73, trainingStatus: "PEAKING" });
    expect(mapTrainingStatus(null)).toEqual({ acuteLoad: null, chronicLoad: null, loadRatio: null, trainingStatus: null });
    const a = mapActivity({ activityId: 1, startTimeLocal: "2026-11-05 05:30:00", distance: 8000, activityTrainingLoad: 87.66, aerobicTrainingEffect: 2.84, anaerobicTrainingEffect: "x" });
    expect([a.trainingLoad, a.aerobicTE, a.anaerobicTE]).toEqual([87.7, 2.8, null]);
  });
});
