import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "./dates";
import { computeInsights, easyDisciplineInsight, keySessionsInsight, missedPatternInsight, raceInsights, readinessInsight, volumeInsight, type InsightInput } from "./insights";
import { planWeek } from "./plan";
import { matchWeek, type DayMatch } from "./rebalance";
import type { Activity, DayStatus, Lap, Wellness } from "./types";

const L = (pairs: [number, number][]): Lap[] => pairs.map(([d, hr]) => ({ distanceM: 1000, durationS: d, avgHr: hr }));
const act = (date: string, laps: Lap[]): Activity => ({
  id: `garmin:${date}`, source: "garmin", startLocal: `${date}T05:30:00`, date, sport: "running", name: "Run",
  distanceM: laps.reduce((s, l) => s + l.distanceM, 0), movingS: laps.reduce((s, l) => s + l.durationS, 0), laps,
});
// Real runs (Strava laps) of the week before Haifa build-down
const RUNS: Activity[] = [
  act("2026-11-05", L([[351, 130], [334, 145], [341, 154], [335, 158], [324, 170], [317, 170], [320, 172], [325, 168]])),
  act("2026-11-06", L([[339, 127], [336, 140], [330, 153], [336, 160], [304, 165], [315, 163]])),
  act("2026-11-07", L([[349, 136], [345, 136], [340, 145], [339, 144], [342, 141], [350, 148], [341, 150], [343, 153], [351, 155], [338, 159], [338, 159], [343, 161], [332, 163], [337, 163], [342, 155], [336, 154], [307, 158], [316, 172], [307, 171], [307, 175], [308, 170], [308, 175], [309, 179], [305, 180]])),
  act("2026-11-09", L([[346, 114], [343, 125], [323, 129], [342, 130], [334, 134], [336, 139], [335, 140], [326, 143], [331, 145], [320, 148]])),
  act("2026-11-10", L([[345, 135], [338, 143], [309, 161], [309, 163], [308, 162], [309, 161], [304, 162], [310, 165], [323, 167], [328, 164], [324, 173], [327, 169]])),
];

function input(today: string, acts = RUNS, statuses: Record<string, DayStatus> = {}, wellness: Wellness[] = []): InsightInput {
  const from = addDays(weekStart(today), -7 * 8);
  const days: DayMatch[] = [];
  for (let ws = from; ws <= weekStart(today); ws = addDays(ws, 7)) {
    days.push(...matchWeek(planWeek(ws, {}), acts.filter((a) => a.date >= ws && a.date <= addDays(ws, 6)), statuses, today));
  }
  return { today, days, acts, wellness };
}

describe("coach insights", () => {
  it("easy-run discipline: flags easy parts run fast (5, 6, 10 Nov) out of the recent runs", () => {
    const i = easyDisciplineInsight(input("2026-11-10"))!;
    expect(i.level).toBe("warn");
    expect(i.title.en).toMatch(/^3 of your last 5 runs with easy parts/);
    expect(i.evidence).toMatch(/05\/11 ↑/);
    expect(i.evidence).toMatch(/09\/11 ✓/);
    expect(i.source).toBe("intensity");
  });

  it("key sessions: MP on 7 and 10 Nov both on target", () => {
    const i = keySessionsInsight(input("2026-11-10"))!;
    expect(i.level).toBe("good");
    expect(i.title.en).toBe("All 2 key parts on target in the last 3 weeks");
  });

  it("readiness: resting HR 5+ above the 14-day median on a quality day -> warn with 'make it easy' action", () => {
    const base: Wellness[] = Array.from({ length: 10 }, (_, k) => ({ date: addDays("2026-11-12", -(k + 1)), restingHr: 48 }));
    const i = readinessInsight(input("2026-11-12", RUNS, {}, [...base, { date: "2026-11-12", restingHr: 55, hrvStatus: "BALANCED", sleepScore: 80 }]))!;
    expect(i.level).toBe("warn");
    expect(i.title.en).toMatch(/resting HR 55 \(\+7 vs your 14-day median\)/);
    expect(i.action?.href).toBe("/day/2026-11-12?edit=easy");
    const ok = readinessInsight(input("2026-11-12", RUNS, {}, [...base, { date: "2026-11-12", restingHr: 49, hrvStatus: "BALANCED", sleepScore: 80 }]))!;
    expect(ok.level).toBe("good");
    expect(ok.body.en).toMatch(/as planned/); // 12 Nov: no run yet in the fixture
    const done = readinessInsight(input("2026-11-10", RUNS, {}, [...base.map((b) => ({ ...b, date: addDays(b.date, -2) })), { date: "2026-11-10", restingHr: 49 }]))!;
    expect(done.body.en).toMatch(/recovering from today's run/);
    expect(readinessInsight(input("2026-11-12"))).toBeNull(); // no data -> no insight
  });

  it("race: prediction range from the 22 Oct half and taper depth", () => {
    const r = raceInsights(input("2026-11-10"));
    const pred = r.find((x) => x.id === "prediction")!;
    expect(pred.title.en).toMatch(/^Predicted range: 3:39:\d\d–3:42:\d\d/);
    expect(pred.body.en).toMatch(/A goal/);
    expect(pred.title.he).toMatch(/^טווח צפוי: בין 3:39:\d\d ל-3:42:\d\d/);
    const taper = r.find((x) => x.id === "taper")!;
    expect(taper.title.en).toMatch(/^10 days to Haifa Marathon: this week 50 km, \d+% below the peak week/);
  });

  it("volume: missed runs -> 'don't make it up'; missed-day pattern needs 2+ on the same weekday", () => {
    const v = volumeInsight(input("2026-11-08", RUNS.filter((a) => a.date !== "2026-11-07" && a.date !== "2026-11-06")))!;
    expect(v.body.en).toMatch(/Don't make up/);
    const st: Record<string, DayStatus> = {
      "2026-10-28": { date: "2026-10-28", status: "skipped", reason: "time" },
      "2026-11-04": { date: "2026-11-04", status: "skipped", reason: "time" },
    };
    // History before the fixture runs is unknown here: treat every other past day as done, so only the two Wednesdays count.
    const allDone = (inp: InsightInput) => ({ ...inp, days: inp.days.map((d) => (d.date < inp.today && d.state === "missed" ? { ...d, state: "done" as const } : d)) });
    const inp = allDone(input("2026-11-10", RUNS, st));
    inp.days = inp.days.map((d) => (d.date === "2026-10-28" || d.date === "2026-11-04" ? { ...d, plan: { ...d.plan, type: "mp", km: 12 }, state: "skipped" } : d));
    const p = missedPatternInsight(inp)!;
    expect(p.title.en).toBe("Wed: 2 missed sessions in 8 weeks");
    expect(p.evidence).toBe("28/10, 04/11");
    expect(missedPatternInsight(allDone(input("2026-11-10")))).toBeNull();
  });

  it("ordering: warnings first, then today/race/week", () => {
    const all = computeInsights(input("2026-11-10"));
    expect(all[0].level).toBe("warn");
    expect(all.map((x) => x.id)).toContain("prediction");
  });
});
