import { describe, expect, it } from "vitest";
import { syncProblem } from "./sync-errors";

describe("syncProblem", () => {
  it("expired Garmin session -> reconnect in Settings", () => {
    const p = syncProblem(["garmin: Garmin session expired - reconnect Garmin in Settings (refresh 400)"])!;
    expect(p.reconnect).toBe(true);
    expect(p.text.he).toMatch(/להתחבר מחדש/);
  });
  it("rate limit / bot protection -> wait and retry", () => {
    expect(syncProblem(["wellness: Garmin rate limit - will retry on next sync"])!.text.en).toMatch(/temporarily blocking/);
    expect(syncProblem(["push: Garmin API /workout-service/workout -> 403"])!.reconnect).toBe(false);
  });
  it("other errors are shown as they are; no errors -> null", () => {
    expect(syncProblem(["push: Garmin API /workout-service/workout -> 500"])!.text.en).toBe("Garmin sync failed: push: Garmin API /workout-service/workout -> 500");
    expect(syncProblem([])).toBeNull();
    expect(syncProblem(undefined)).toBeNull();
  });
});
