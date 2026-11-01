import { describe, expect, it } from "vitest";
import { planWeek, HAIFA_PLAN } from "./plan";
import { matchWeek, proposeRebalance, weekKm } from "./rebalance";
import type { Activity } from "./types";

const W5 = "2026-08-17";
const W16 = "2026-11-02";
const W18 = "2026-11-16";

describe("plan", () => {
  it("has 18 weeks ending with the Haifa marathon on Fri 20 Nov", () => {
    expect(HAIFA_PLAN.length).toBe(18 * 7);
    const race = HAIFA_PLAN.find((w) => w.type === "race" && w.km === 42.2);
    expect(race?.date).toBe("2026-11-20");
  });
  it("approved W16 is ~62 km with hills on Tuesday", () => {
    const w = planWeek(W16, {});
    expect(w[1].type).toBe("hills");
    expect(weekKm(w)).toBeGreaterThanOrEqual(60);
    expect(weekKm(w)).toBeLessThanOrEqual(64);
  });
});

describe("rebalance", () => {
  it("drops a missed easy run", () => {
    const p = proposeRebalance(planWeek(W5, {}), W5, "time", W5);
    expect(p.changes).toHaveLength(0);
  });

  it("moves a missed key session once to a later easy day, shortened, without raising the week", () => {
    const week = planWeek(W5, {});
    const p = proposeRebalance(week, "2026-08-18", "time", "2026-08-18");
    expect(p.changes).toHaveLength(1);
    const c = p.changes[0];
    expect(c.date).toBe("2026-08-19");
    expect(c.to.type).toBe("tempo");
    expect(c.to.km).toBeLessThan(week[1].km);
    const after = week.map((w) => (w.date === c.date ? c.to : w.date === "2026-08-18" ? { ...w, km: 0 } : w));
    expect(weekKm(after)).toBeLessThanOrEqual(weekKm(week));
  });

  it("never creates back-to-back hard days (missed Fri MP before Sat long -> dropped)", () => {
    const p = proposeRebalance(planWeek(W5, {}), "2026-08-21", "time", "2026-08-21");
    expect(p.changes).toHaveLength(0);
  });

  it("taper: missed key sessions are dropped", () => {
    const p = proposeRebalance(planWeek(W16, {}), "2026-11-04", "time", "2026-11-04");
    expect(p.changes).toHaveLength(0);
    expect(p.summary.en).toMatch(/Taper/);
  });

  it("ill: next 2 days easy and the long run cut ~25%", () => {
    const p = proposeRebalance(planWeek(W16, {}), W16, "ill", W16);
    const tue = p.changes.find((c) => c.date === "2026-11-03");
    const wed = p.changes.find((c) => c.date === "2026-11-04");
    const sat = p.changes.find((c) => c.date === "2026-11-07");
    expect(tue?.to.type).toBe("easy");
    expect(wed?.to.type).toBe("easy");
    expect(sat?.to.km).toBe(18);
  });

  it("ill reported late: only days within 2 days of the illness change; today's long run is only cut 25%", () => {
    const W15 = "2026-10-26";
    const p = proposeRebalance(planWeek(W15, {}), "2026-10-28", "ill", "2026-10-31");
    expect(p.changes).toHaveLength(1);
    expect(p.changes[0].date).toBe("2026-10-31");
    expect(p.changes[0].to.type).toBe("long");
    expect(p.changes[0].to.km).toBe(26.5);
  });

  it("fever: rest 2 days", () => {
    const p = proposeRebalance(planWeek(W16, {}), W16, "fever", W16);
    expect(p.changes.slice(0, 2).every((c) => c.to.type === "rest")).toBe(true);
  });

  it("niggle: no quality left in the week", () => {
    const p = proposeRebalance(planWeek(W16, {}), W16, "niggle", W16);
    expect(p.changes.every((c) => c.to.type === "easy")).toBe(true);
    expect(p.changes.length).toBeGreaterThanOrEqual(3);
  });

  it("race week is locked", () => {
    const p = proposeRebalance(planWeek(W18, {}), W18, "ill", W18);
    expect(p.changes).toHaveLength(0);
  });
});

describe("matchWeek", () => {
  const act = (date: string, km: number): Activity => ({
    id: "garmin:" + date, source: "garmin", startLocal: date + "T05:30:00", date, sport: "running", name: "Run", distanceM: km * 1000, movingS: km * 310,
  });
  it("classifies done / partial / missed / extra / future", () => {
    const week = planWeek(W16, {});
    const m = matchWeek(week, [act("2026-11-02", 10), act("2026-11-03", 3), act("2026-11-05", 6)], {}, "2026-11-06");
    expect(m.map((d) => d.state)).toEqual(["done", "partial", "missed", "extra", "today", "future", "future"]);
  });
  it("a session run on the next (rest) day counts as moved", () => {
    const week = planWeek(W16, {});
    const m = matchWeek(week, [act("2026-11-05", 12)], {}, "2026-11-06");
    expect(m[2].state).toBe("moved");
    expect(m[3].state).toBe("moved");
  });
});
