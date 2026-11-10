import { describe, expect, it } from "vitest";
import { analyzeRun, hrQuality, segmentize } from "./analysis";
import { planFor } from "./plan";
import type { Activity, Lap } from "./types";

// Real laps from the athlete's Strava (moving time s, avg HR), 1 km auto-laps.
const L = (pairs: [number, number][], last?: [number, number, number]): Lap[] => [
  ...pairs.map(([d, hr]) => ({ distanceM: 1000, durationS: d, avgHr: hr })),
  ...(last ? [{ distanceM: last[0], durationS: last[1], avgHr: last[2] }] : []),
];
const act = (date: string, laps: Lap[]): Activity => ({
  id: `garmin:${date}`, source: "garmin", startLocal: `${date}T05:30:00`, date, sport: "running", name: "Run",
  distanceM: laps.reduce((s, l) => s + l.distanceM, 0), movingS: laps.reduce((s, l) => s + l.durationS, 0), laps,
});

const MON_9 = L([[346, 114], [343, 125], [323, 129], [342, 130], [334, 134], [336, 139], [335, 140], [326, 143], [331, 145], [320, 148]], [301, 96, 146]);
const THU_5 = L([[351, 130], [334, 145], [341, 154], [335, 158], [324, 170], [317, 170], [320, 172], [325, 168]]);
const SAT_7 = L([[349, 136], [345, 136], [340, 145], [339, 144], [342, 141], [350, 148], [341, 150], [343, 153], [351, 155], [338, 159], [338, 159], [343, 161], [332, 163], [337, 163], [342, 155], [336, 154],
  [307, 158], [316, 172], [307, 171], [307, 175], [308, 170], [308, 175], [309, 179], [305, 180]]);
const TUE_10 = L([[345, 135], [338, 143], [309, 161], [309, 163], [308, 162], [309, 161], [304, 162], [310, 165], [323, 167], [328, 164], [324, 173], [327, 169]]);

describe("post-run analysis", () => {
  it("Sat 7 Nov long run: easy part and marathon pace both on target; HR flagged as unreliable", () => {
    const a = analyzeRun(planFor("2026-11-07", {}), act("2026-11-07", SAT_7), 6);
    const mp = a.segments.find((s) => s.role === "quality")!;
    expect(mp.km).toBe(8);
    expect(mp.verdict).toBe("ok");
    expect(a.segments.find((s) => s.role === "easy")!.verdict).toBe("ok");
    expect(a.findings.some((f) => f.level === "good" && f.text.en.startsWith("Marathon pace on target"))).toBe(true);
    expect(a.hr.quality).toBe("suspect"); // +14 bpm in one lap with pace change <3%
    expect(a.headline).toBe("good");
    expect(a.srpe).toBe(6 * Math.round(a.minutes));
  });

  it("Tue 10 Nov: MP on target, but the 'easy' cool-down ran fast", () => {
    const a = analyzeRun(planFor("2026-11-10", {}), act("2026-11-10", TUE_10));
    const segs = a.segments.map((s) => [s.label.en, s.km, s.verdict]);
    expect(segs).toEqual([["Warm-up", 2, "ok"], ["Marathon pace", 6, "ok"], ["Cool-down", 4, "ok"]]);
    const cd = a.findings.find((f) => f.level === "warn")!;
    expect(cd.text.en).toMatch(/^Cool-down: 50% of the distance faster than 5:30/);
    expect(a.headline).toBe("warn");
    expect(a.findings.some((f) => f.text.en.startsWith("Rate the effort"))).toBe(true);
  });

  it("Thu 5 Nov easy run: fast finish flagged; HR suspect against the athlete's own baseline", () => {
    const a = analyzeRun(planFor("2026-11-05", {}), act("2026-11-05", THU_5), null, MON_9);
    const warn = a.findings.find((f) => f.level === "warn")!;
    expect(warn.text.en).toMatch(/38% of the distance faster than 5:30, mostly at the end/);
    expect(a.hr.quality).toBe("suspect");
    expect(a.hr.reasons.join(" ")).toMatch(/vs your usual ~1[34]\d at 5:2/);
  });

  it("Mon 9 Nov easy run stays easy; HR plausible", () => {
    const a = analyzeRun(planFor("2026-11-09", {}), act("2026-11-09", MON_9), 3);
    expect(a.findings.some((f) => f.level === "warn")).toBe(false);
    expect(a.findings.some((f) => f.text.en === "Easy running stayed easy.")).toBe(true);
    expect(a.hr.quality).toBe("ok");
  });

  it("effort that doesn't match the day is flagged", () => {
    const a = analyzeRun(planFor("2026-11-09", {}), act("2026-11-09", MON_9), 7);
    expect(a.findings.some((f) => f.level === "warn" && f.text.en.startsWith("Effort 7/10 on an easy day"))).toBe(true);
  });

  it("intervals: all reps grouped, recoveries not judged; hills never judged on pace", () => {
    const reps = L([[340, 0], [335, 0], [295, 0]], undefined);
    const laps: Lap[] = [
      { distanceM: 2000, durationS: 680 },
      ...[0, 1, 2].flatMap(() => [{ distanceM: 1000, durationS: 295 }, { distanceM: 500, durationS: 190 }]),
      { distanceM: 1500, durationS: 510 },
    ];
    void reps;
    const segs = segmentize(planFor("2026-11-12", {}), laps);
    expect(segs.map((s) => [s.label.en, s.km, s.verdict])).toEqual([["Warm-up", 2, "ok"], ["Reps", 3, "ok"], ["Recoveries", 1.5, null], ["Cool-down", 1.5, "ok"]]);
    const hills = segmentize(planFor("2026-11-03", {}), laps);
    expect(hills.every((s) => s.verdict === null)).toBe(true);
  });

  it("no HR -> quality none; plausible HR -> ok", () => {
    expect(hrQuality([{ distanceM: 1000, durationS: 330 }, { distanceM: 1000, durationS: 330 }]).quality).toBe("none");
    expect(hrQuality(MON_9).quality).toBe("ok");
  });
});

describe("lap targets", () => {
  it("each lap is judged against its own part of the workout", async () => {
    const { lapTargets } = await import("./analysis");
    const tg = lapTargets(planFor("2026-11-10", {}), TUE_10);
    expect(tg[0]).toEqual([330, 390]); // warm-up
    expect(tg[4]).toEqual([307, 313]); // marathon pace
    expect(tg[10]).toEqual([330, 390]); // cool-down
  });
  it("no false HR alarm in a cool-down after fast running (baseline check skipped)", () => {
    const a = analyzeRun(planFor("2026-11-10", {}), act("2026-11-10", TUE_10), null, MON_9);
    expect(a.hr.reasons.join(" ")).not.toMatch(/usual/);
  });
});
