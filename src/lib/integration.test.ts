/**
 * Integration tests against a real, LOCAL Postgres. They delete all rows, so they
 * only ever use TEST_DATABASE_URL and refuse anything that isn't localhost:
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/mc_test npx vitest run
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const TEST_URL = process.env.TEST_DATABASE_URL ?? "";
const RUN = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(TEST_URL);
if (RUN) {
  process.env.DATABASE_URL = TEST_URL;
  process.env.ENCRYPTION_KEY = "test-key-0123456789";
}
const d = RUN ? describe : describe.skip;

vi.mock("./dates", async (orig) => {
  const m: any = await orig();
  return { ...m, todayLocal: () => "2026-11-04" };
});

function fakeGarmin() {
  const acts = Array.from({ length: 230 }, (_, i) => ({
    activityId: 1000 + i,
    activityName: `Run ${i}`,
    startTimeLocal: `2026-${String(11 - Math.floor(i / 28)).padStart(2, "0")}-${String(28 - (i % 28)).padStart(2, "0")} 05:30:00`,
    activityType: { typeKey: "running" },
    distance: 10000,
    movingDuration: 3100,
    averageHR: 150,
  }));
  const created: any[] = [];
  const deleted: number[] = [];
  let nextId = 1;
  const g: any = {
    refreshed: false,
    tokens: {},
    activities: async (start: number, limit: number) => acts.slice(start, start + limit),
    splits: async () => ({ lapDTOs: [{ distance: 1000, movingDuration: 310, averageHR: 150 }, { distance: 1000, movingDuration: 309, averageHR: 152 }, { distance: 1000, movingDuration: 311, averageHR: 153 }] }),
    profile: async () => ({ displayName: "shaked" }),
    hrv: async () => ({ hrvSummary: { lastNightAvg: 55, status: "BALANCED" } }),
    sleep: async () => ({ dailySleepDTO: { sleepScores: { overall: { value: 80 } } } }),
    bodyBattery: async () => [],
    readiness: async () => [{ score: 70 }],
    trainingStatus: async () => ({ mostRecentTrainingStatus: { latestTrainingStatusData: { "1": { trainingStatusFeedbackPhrase: "PEAKING_1", acuteTrainingLoadDTO: { dailyTrainingLoadAcute: 400, dailyTrainingLoadChronic: 600, dailyAcuteChronicWorkloadRatio: 0.67 } } } } }),
    userSummary: async () => ({ restingHeartRate: 48 }),
    createWorkout: async (w: any) => { created.push(w); return { workoutId: nextId++ }; },
    scheduleWorkout: async () => ({}),
    deleteWorkout: async (id: number) => { deleted.push(id); },
  };
  return { g, created, deleted, acts };
}

d("integration (postgres)", () => {
  let db: typeof import("./db");
  let sync: typeof import("./sync");
  beforeAll(async () => {
    db = await import("./db");
    sync = await import("./sync");
    await db.q("SELECT 1");
    await db.deleteAllData();
  });

  it("kv + encryption roundtrip", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    await db.kvSet("t", encrypt({ a: 1 }));
    expect(decrypt<{ a: number }>((await db.kvGet<string>("t"))!)).toEqual({ a: 1 });
  });

  it("imports full Garmin history across pages, with laps, idempotently", async () => {
    const { g, acts } = fakeGarmin();
    const deadline = { ok: () => true, left: () => 1e9 } as any;
    const r1 = await sync.syncGarminActivities(g, deadline);
    expect(r1.historyDone).toBe(true);
    const r2 = await sync.syncGarminActivities(g, deadline);
    expect(r2.historyDone).toBe(true);
    const c = await db.activityCount();
    expect(c.find((x) => x.source === "garmin")?.n).toBe(acts.length);
    const a = await db.activitiesBetween("2026-11-01", "2026-11-30");
    expect(a[0].date >= "2026-11-01").toBe(true);
    expect(a[0].startLocal).toMatch(/T05:30:00$/);
  });

  it("wellness: recent days + backfill cursor moves back", async () => {
    const { g } = fakeGarmin();
    const deadline = { ok: () => true } as any;
    const r = await sync.syncGarminWellness(g, deadline);
    expect(r.days).toBe(17);
    const r2 = await sync.syncGarminWellness(g, deadline);
    expect(r2.backTo < r.backTo).toBe(true);
    const w = await db.wellnessBetween("2026-11-04", "2026-11-04");
    expect(w[0]).toMatchObject({ hrvAvg: 55, sleepScore: 80, readiness: 70, restingHr: 48 });
    expect(w.some((x) => x.loadRatio === 0.67 && x.trainingStatus === "PEAKING")).toBe(true);
  });

  it("pushes 7 days of workouts once, and replaces only changed days", async () => {
    const { g, created, deleted } = fakeGarmin();
    const first = await sync.pushWorkouts(g);
    expect(first.length).toBe(created.length);
    expect(created.length).toBeGreaterThan(3);
    const again = await sync.pushWorkouts(g);
    expect(again).toEqual([]);
    const { planFor } = await import("./plan");
    await db.setOverride({ ...planFor("2026-11-06", {}), km: 5, title: { en: "5 km easy", he: "5 קל" } }, "test");
    const third = await sync.pushWorkouts(g);
    expect(third).toEqual([{ date: "2026-11-06", action: "updated" }]);
    expect(deleted.length).toBe(1);
  });

  it("skip -> proposal -> accept writes overrides", async () => {
    const { proposeRebalance } = await import("./rebalance");
    const { planWeek } = await import("./plan");
    const p = proposeRebalance(planWeek("2026-11-02", {}), "2026-11-04", "ill", "2026-11-04");
    const id = await db.addProposal(p);
    expect((await db.pendingProposals()).map((x) => x.id)).toContain(id);
    for (const c of p.changes) await db.setOverride(c.to, "ill");
    await db.setProposalStatus(id, "accepted");
    const o = await db.overridesBetween("2026-11-02", "2026-11-08");
    expect(o["2026-11-07"].km).toBe(18);
    expect((await db.pendingProposals()).length).toBe(0);
  });

  it("lock is exclusive until released", async () => {
    expect(await db.tryLock("x", 60_000)).toBe(true);
    expect(await db.tryLock("x", 60_000)).toBe(false);
    await db.unlock("x");
    expect(await db.tryLock("x", 60_000)).toBe(true);
    await db.unlock("x");
  });

  it("login throttle locks after 5 failures", async () => {
    for (let i = 0; i < 5; i++) await db.recordLogin(false);
    expect(await db.loginBlocked()).toBe(true);
    await db.recordLogin(true);
    expect(await db.loginBlocked()).toBe(false);
  });

  it("strava copies of garmin runs are marked duplicates and hidden", async () => {
    const { isSameRun } = await import("./sync");
    const base = { id: "garmin:1", source: "garmin", startLocal: "2026-11-01T05:30:00", date: "2026-11-01", sport: "running", name: "", distanceM: 10000, movingS: 3000 } as const;
    expect(isSameRun(base as any, { ...base, id: "strava:1", source: "strava", startLocal: "2026-11-01T05:30:40", distanceM: 10040 } as any)).toBe(true);
    expect(isSameRun(base as any, { ...base, startLocal: "2026-11-01T17:30:00" } as any)).toBe(false);
  });

  it("strength/mobility status roundtrip and strength pushed to Garmin", async () => {
    await db.setExtraStatus("2026-11-03", "strength", "done");
    await db.setExtraStatus("2026-11-03", "mobility", "skipped");
    expect(await db.extraStatusesBetween("2026-11-03", "2026-11-03")).toEqual({ "2026-11-03:strength": "done", "2026-11-03:mobility": "skipped" });
    await db.setExtraStatus("2026-11-03", "mobility", null);
    expect(Object.keys(await db.extraStatusesBetween("2026-11-03", "2026-11-03"))).toEqual(["2026-11-03:strength"]);
    const pushed = await db.extraPushesBetween("2026-11-04", "2026-11-10");
    expect(Object.keys(pushed).sort()).toEqual(["2026-11-05:strength", "2026-11-10:strength"]);
  });

  it("delete all data wipes everything", async () => {
    await db.deleteAllData();
    expect(await db.activityCount()).toEqual([]);
    expect(await db.kvGet("t")).toBeNull();
  });
});
