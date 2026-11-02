import type { Lap, PaceRange, WorkoutType } from "./types";

/** Steady runs where every lap should sit in the planned pace range. Interval/hill/fast sessions mix paces, so laps aren't judged. */
const STEADY: WorkoutType[] = ["easy", "medium", "long", "mp", "tempo"];
const TOL = 5; // s/km grace either side

export type LapVerdict = "ok" | "fast" | "slow" | null;

export function lapVerdict(lap: Lap, type: WorkoutType, pace?: PaceRange): LapVerdict {
  if (!pace || !STEADY.includes(type) || lap.distanceM < 400) return null;
  const p = lap.durationS / (lap.distanceM / 1000);
  if (p < pace[0] - TOL) return "fast";
  if (p > pace[1] + TOL) return "slow";
  return "ok";
}

/** Share of steady-run distance inside the planned range (null when not judged). */
export function onPaceShare(laps: Lap[], type: WorkoutType, pace?: PaceRange): number | null {
  let tot = 0, ok = 0;
  for (const l of laps) {
    const v = lapVerdict(l, type, pace);
    if (v === null) continue;
    tot += l.distanceM;
    if (v === "ok") ok += l.distanceM;
  }
  return tot > 0 ? Math.round((ok / tot) * 100) : null;
}

export const isIsoDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
