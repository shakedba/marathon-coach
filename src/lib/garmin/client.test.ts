import { describe, expect, it } from "vitest";
import { oauth1Header } from "./client";
import { toGarminWorkout } from "./mappers";
import { planFor } from "../plan";

describe("oauth1Header", () => {
  it("matches the oauthlib (python) reference signature", () => {
    const h = oauth1Header(
      "POST",
      "https://connectapi.garmin.com/oauth-service/oauth/exchange/user/2.0?x=1%202&login-url=https%3A%2F%2Fa.b%2Fc",
      { consumer_key: "ck", consumer_secret: "cs" },
      { key: "tk", secret: "ts" },
      { audience: "GARMIN", mfa_token: "m/1" },
      "abc",
      "1700000000",
    );
    expect(h).toContain('oauth_signature="31ZNwg8BVdCkrxqX2Fv%2Ba8Vw9S0%3D"');
  });
});

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
