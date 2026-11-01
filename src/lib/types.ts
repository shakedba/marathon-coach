export type Lang = "he" | "en";
export type Text = { en: string; he: string };

export type WorkoutType =
  | "rest"
  | "easy"
  | "medium"
  | "long"
  | "mp"
  | "fast"
  | "tempo"
  | "intervals"
  | "hills"
  | "race";

/** Pace range in seconds per km: [fast, slow]. */
export type PaceRange = [number, number];

export type Step =
  | {
      kind: "warmup" | "cooldown" | "active" | "recovery";
      distM?: number;
      timeS?: number;
      pace?: PaceRange;
      hrMax?: number;
    }
  | { kind: "repeat"; times: number; steps: Step[] };

export interface Workout {
  date: string; // YYYY-MM-DD
  type: WorkoutType;
  km: number;
  title: Text;
  pace?: PaceRange;
  hrCap?: number;
  notes?: Text;
  /** Key sessions (long, MP, quality, race) may be moved once; easy runs are dropped. */
  key: boolean;
  steps?: Step[];
}

export interface RaceInfo {
  id: string;
  name: Text;
  date: string;
  startTime: string;
  goalPace?: number; // sec/km
  goalTime?: string;
}

export type SkipReason = "time" | "tired" | "ill" | "fever" | "niggle";

export interface DayStatus {
  date: string;
  status: "done" | "skipped";
  reason?: SkipReason;
  feel?: number;
  note?: string;
}

export interface Activity {
  id: string; // "garmin:123" or "strava:456"
  source: "garmin" | "strava";
  startLocal: string; // ISO local
  date: string; // YYYY-MM-DD local
  sport: string;
  name: string;
  distanceM: number;
  movingS: number;
  avgHr?: number | null;
  maxHr?: number | null;
  elevGain?: number | null;
  isRace?: boolean;
  laps?: Lap[] | null;
}

export interface Lap {
  distanceM: number;
  durationS: number;
  avgHr?: number | null;
}

export interface Wellness {
  date: string;
  hrvAvg?: number | null;
  hrvStatus?: string | null;
  sleepScore?: number | null;
  bodyBatteryHigh?: number | null;
  readiness?: number | null;
  restingHr?: number | null;
}

export interface Change {
  date: string;
  from: Workout;
  to: Workout;
  why: Text;
}

export interface Proposal {
  weekStart: string;
  trigger: { date: string; reason?: SkipReason };
  changes: Change[];
  summary: Text;
}
