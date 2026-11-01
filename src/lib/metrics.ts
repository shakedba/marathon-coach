import { addDays, weekStart } from "./dates";
import { planWeek } from "./plan";
import type { Activity, Text, Wellness, Workout } from "./types";

const isRun = (a: Activity) => /run/i.test(a.sport);

export function weeklyVolume(from: string, to: string, acts: Activity[], overrides: Record<string, Workout>) {
  const out: { week: string; planned: number; actual: number }[] = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const actual = acts.filter((a) => isRun(a) && a.date >= w && a.date <= end).reduce((s, a) => s + a.distanceM, 0) / 1000;
    const planned = planWeek(w, overrides).reduce((s, x) => s + x.km, 0);
    out.push({ week: w, planned: Math.round(planned * 10) / 10, actual: Math.round(actual * 10) / 10 });
  }
  return out;
}

/** HR on km-laps run at goal marathon pace +-10 s: the main readiness signal (lower HR at the same pace = fitter). */
export function mpEfficiency(acts: Activity[], goalPace = 310, tol = 10) {
  const pts: { date: string; pace: number; hr: number; km: number }[] = [];
  for (const a of acts) {
    if (!isRun(a) || !a.laps?.length) continue;
    const laps = a.laps.filter((l) => l.distanceM >= 800 && l.avgHr && Math.abs(l.durationS / (l.distanceM / 1000) - goalPace) <= tol);
    if (laps.length < 3) continue;
    const dist = laps.reduce((s, l) => s + l.distanceM, 0);
    const time = laps.reduce((s, l) => s + l.durationS, 0);
    const hr = laps.reduce((s, l) => s + (l.avgHr ?? 0) * l.distanceM, 0) / dist;
    pts.push({ date: a.date, pace: time / (dist / 1000), hr: Math.round(hr), km: Math.round(dist / 100) / 10 });
  }
  return pts;
}

/** Results entered by hand where the watch didn't tag the run as a race. */
export const KNOWN_RESULTS = [{ date: "2026-10-22", km: 21.0975, seconds: 6306, label: "Half (tune-up)" }];

/** Riegel prediction from the best race-like result in the last 120 days. */
export function predictMarathon(acts: Activity[], today: string) {
  const since = addDays(today, -120);
  const races = [
    ...KNOWN_RESULTS.filter((r) => r.date >= since),
    ...acts.filter((a) => a.isRace && isRun(a) && a.date >= since && a.distanceM >= 5000).map((a) => ({ date: a.date, km: a.distanceM / 1000, seconds: a.movingS, label: a.name })),
  ];
  if (!races.length) return null;
  const preds = races.map((r) => ({ ...r, marathon: r.seconds * Math.pow(42.195 / r.km, 1.06) }));
  return preds.sort((a, b) => a.marathon - b.marathon)[0];
}

export function readinessFlag(w: Wellness | undefined): Text | null {
  if (!w) return null;
  const reasons: string[] = [];
  const he: string[] = [];
  if (w.hrvStatus && /LOW|POOR|UNBALANCED/i.test(w.hrvStatus)) { reasons.push(`HRV ${w.hrvStatus.toLowerCase()}`); he.push(`HRV ${w.hrvStatus.toLowerCase()}`); }
  if (w.sleepScore != null && w.sleepScore < 50) { reasons.push(`sleep score ${w.sleepScore}`); he.push(`ציון שינה ${w.sleepScore}`); }
  if (w.bodyBatteryHigh != null && w.bodyBatteryHigh < 40) { reasons.push(`Body Battery ${w.bodyBatteryHigh}`); he.push(`Body Battery ${w.bodyBatteryHigh}`); }
  if (w.readiness != null && w.readiness < 35) { reasons.push(`readiness ${w.readiness}`); he.push(`מוכנות ${w.readiness}`); }
  if (!reasons.length) return null;
  return {
    en: `Recovery looks low (${reasons.join(", ")}). Consider swapping today's quality for easy.`,
    he: `ההתאוששות נראית נמוכה (${he.join(", ")}). שקול להחליף את אימון האיכות של היום בקל.`,
  };
}
