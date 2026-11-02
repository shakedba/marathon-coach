import { describe, expect, it } from "vitest";
import { planWeek, HAIFA_PLAN } from "./plan";
import { matchWeek, proposeRebalance, weekKm } from "./rebalance";
import type { Activity } from "./types";
import { applyEdit, parseOp } from "./edit";

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

describe("manual edits (checkEdit / applyEdit)", () => {
  const W17 = "2026-11-09";
  it("warns when a move creates two hard days in a row", () => {
    const r = applyEdit(planWeek(W16, {}), "2026-11-04", { kind: "move", to: "2026-11-02" }, "2026-11-02");
    expect(r.block).toBeNull();
    expect(r.warnings.some((w) => w.en.includes("Two hard days"))).toBe(true);
    expect(r.writes.map((x) => [x.w.date, x.w.type, x.reason])).toEqual([
      ["2026-11-02", "mp", "swap:2026-11-04"],
      ["2026-11-04", "easy", "swap:2026-11-02"],
    ]);
    expect(r.writes[0].w.notes?.en.startsWith("Moved from 2026-11-04")).toBe(true);
  });
  it("blocks past days, other weeks and race day", () => {
    expect(applyEdit(planWeek(W16, {}), "2026-11-04", { kind: "move", to: "2026-11-02" }, "2026-11-03").block?.en).toMatch(/Past/);
    expect(applyEdit(planWeek(W16, {}), "2026-11-07", { kind: "move", to: "2026-11-09" }, "2026-11-02").block?.en).toMatch(/same week/);
    expect(applyEdit(planWeek(W18, {}), "2026-11-20", { kind: "rest" }, "2026-11-16").block).not.toBeNull();
    expect(applyEdit(planWeek(W18, {}), "2026-11-18", { kind: "move", to: "2026-11-20" }, "2026-11-16").block).not.toBeNull();
  });
  it("race week: only easier/shorter/rest", () => {
    expect(applyEdit(planWeek(W18, {}), "2026-11-16", { kind: "move", to: "2026-11-17" }, "2026-11-16").block?.en).toMatch(/Race week/);
    expect(applyEdit(planWeek(W18, {}), "2026-11-17", { kind: "add", km: 6 }, "2026-11-16").block?.en).toMatch(/Race week/);
    const r = applyEdit(planWeek(W18, {}), "2026-11-16", { kind: "short" }, "2026-11-16");
    expect(r.block).toBeNull();
    expect(r.writes[0].w.km).toBe(6);
  });
  it("adding a run in the taper warns (>10% and taper)", () => {
    const r = applyEdit(planWeek(W17, {}), "2026-11-12", { kind: "add", km: 10 }, "2026-11-09");
    expect(r.block).toBeNull();
    expect(r.writes[0].w).toMatchObject({ type: "easy", km: 10, date: "2026-11-12" });
    expect(r.warnings.map((w) => w.en).join(" ")).toMatch(/more than 10%.*Taper/);
  });
  it("resting a key session warns; making it easy keeps it under 10 km", () => {
    const rest = applyEdit(planWeek(W16, {}), "2026-11-07", { kind: "rest" }, "2026-11-02");
    expect(rest.warnings.some((w) => w.en.includes("key session"))).toBe(true);
    const easy = applyEdit(planWeek(W16, {}), "2026-11-07", { kind: "easy" }, "2026-11-02");
    expect(easy.writes[0].w).toMatchObject({ type: "easy", km: 10, hrCap: 145 });
  });
  it("warns when moving a session that was already moved", () => {
    const first = applyEdit(planWeek(W16, {}), "2026-11-07", { kind: "move", to: "2026-11-06" }, "2026-11-02");
    const ov = Object.fromEntries(first.writes.map((x) => [x.w.date, x.w]));
    const again = applyEdit(planWeek(W16, ov), "2026-11-06", { kind: "move", to: "2026-11-08" }, "2026-11-02");
    expect(again.warnings.some((w) => w.en.includes("already moved"))).toBe(true);
  });
  it("parses only valid ops", () => {
    expect(parseOp("add-8")).toEqual({ kind: "add", km: 8 });
    expect(parseOp("add-20")).toBeNull();
    expect(parseOp("move-2026-11-03")).toEqual({ kind: "move", to: "2026-11-03" });
    expect(parseOp("move-x")).toBeNull();
    expect(parseOp("drop table")).toBeNull();
  });
});
