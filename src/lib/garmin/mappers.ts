import type { Activity, Lap, Step, Wellness, Workout } from "../types";
import type { Exercise, Extra } from "../extras";
import { fmtPace } from "../dates";

const RUNNING = { sportTypeId: 1, sportTypeKey: "running", displayOrder: 1 };
const STEP_TYPES = {
  warmup: { stepTypeId: 1, stepTypeKey: "warmup", displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: "cooldown", displayOrder: 2 },
  active: { stepTypeId: 3, stepTypeKey: "interval", displayOrder: 3 },
  recovery: { stepTypeId: 4, stepTypeKey: "recovery", displayOrder: 4 },
  repeat: { stepTypeId: 6, stepTypeKey: "repeat", displayOrder: 6 },
};
const DISTANCE = { conditionTypeId: 3, conditionTypeKey: "distance", displayOrder: 3, displayable: true };
const TIME = { conditionTypeId: 2, conditionTypeKey: "time", displayOrder: 2, displayable: true };
const LAP = { conditionTypeId: 1, conditionTypeKey: "lap.button", displayOrder: 1, displayable: true };
const ITER = { conditionTypeId: 7, conditionTypeKey: "iterations", displayOrder: 7, displayable: false };
const NO_TARGET = { workoutTargetTypeId: 1, workoutTargetTypeKey: "no.target", displayOrder: 1 };
const PACE = { workoutTargetTypeId: 6, workoutTargetTypeKey: "pace.zone", displayOrder: 6 };

const speed = (secPerKm: number) => Math.round((1000 / secPerKm) * 10000) / 10000;

/** Convert a plan workout to a Garmin Connect workout (pace targets, HR cap in step notes). */
export function toGarminWorkout(w: Workout) {
  let order = 0;
  const conv = (s: Step): any => {
    order += 1;
    if (s.kind === "repeat") {
      return {
        type: "RepeatGroupDTO",
        stepOrder: order,
        stepType: STEP_TYPES.repeat,
        numberOfIterations: s.times,
        smartRepeat: false,
        endCondition: ITER,
        endConditionValue: s.times,
        workoutSteps: s.steps.map(conv),
      };
    }
    return {
      type: "ExecutableStepDTO",
      stepOrder: order,
      stepType: STEP_TYPES[s.kind],
      description: s.hrMax ? `HR <= ${s.hrMax}` : s.pace ? `${fmtPace(s.pace[0])}-${fmtPace(s.pace[1])}/km` : undefined,
      endCondition: s.distM ? DISTANCE : s.timeS ? TIME : LAP,
      endConditionValue: s.distM ?? s.timeS ?? undefined,
      targetType: s.pace ? PACE : NO_TARGET,
      targetValueOne: s.pace ? speed(s.pace[1]) : undefined,
      targetValueTwo: s.pace ? speed(s.pace[0]) : undefined,
    };
  };
  const steps: Step[] = w.steps ?? [{ kind: "active", distM: w.km * 1000, pace: w.pace, hrMax: w.hrCap }];
  const avgPace = w.pace ? (w.pace[0] + w.pace[1]) / 2 : 330;
  return {
    workoutName: `MC ${w.date.slice(5)} ${w.title.en}`.slice(0, 60),
    description: [w.hrCap ? `HR cap ${w.hrCap}` : "", w.notes?.en ?? ""].filter(Boolean).join(" | ") || undefined,
    sportType: RUNNING,
    estimatedDurationInSecs: Math.round(w.km * avgPace),
    workoutSegments: [{ segmentOrder: 1, sportType: RUNNING, workoutSteps: steps.map(conv) }],
  };
}

const STRENGTH = { sportTypeId: 5, sportTypeKey: "strength_training", displayOrder: 5 };

/** Strength session as a Garmin workout: one lap-button step per exercise (name + dose in the step note), repeated per round. */
export function toGarminStrength(x: Extra) {
  let order = 0;
  const step = (e: Exercise) => ({
    type: "ExecutableStepDTO",
    stepOrder: ++order,
    stepType: STEP_TYPES.active,
    description: `${e.name.en}: ${e.dose.en}`.slice(0, 120),
    endCondition: LAP,
    targetType: NO_TARGET,
  });
  let steps: any[];
  if (x.rounds > 1) {
    const groupOrder = ++order;
    steps = [{
      type: "RepeatGroupDTO", stepOrder: groupOrder, stepType: STEP_TYPES.repeat, numberOfIterations: x.rounds, smartRepeat: false,
      endCondition: ITER, endConditionValue: x.rounds, workoutSteps: x.exercises.map(step),
    }];
  } else {
    steps = x.exercises.map(step);
  }
  return {
    workoutName: `MC ${x.date.slice(5)} ${x.title.en}`.slice(0, 60),
    description: x.note?.en,
    sportType: STRENGTH,
    estimatedDurationInSecs: x.minutes * 60,
    workoutSegments: [{ segmentOrder: 1, sportType: STRENGTH, workoutSteps: steps }],
  };
}

export function mapActivity(a: any): Activity {
  const startLocal = String(a.startTimeLocal ?? "").replace(" ", "T");
  return {
    id: `garmin:${a.activityId}`,
    source: "garmin",
    startLocal,
    date: startLocal.slice(0, 10),
    sport: a.activityType?.typeKey ?? "unknown",
    name: a.activityName ?? "",
    distanceM: Number(a.distance ?? 0),
    movingS: Math.round(Number(a.movingDuration ?? a.duration ?? 0)),
    avgHr: a.averageHR ?? null,
    maxHr: a.maxHR ?? null,
    elevGain: a.elevationGain ?? null,
    isRace: a.eventType?.typeKey === "race",
    trainingLoad: num(a.activityTrainingLoad),
    aerobicTE: num(a.aerobicTrainingEffect),
    anaerobicTE: num(a.anaerobicTrainingEffect),
  };
}

const num = (v: unknown, dp = 1): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10 ** dp) / 10 ** dp : null);

/**
 * Training status (/metrics-service/metrics/trainingstatus/aggregated/{date}). Only derived numbers are kept.
 * The payload is keyed by device id; the primary device's entry is used, else the first one.
 */
export function mapTrainingStatus(res: any): { acuteLoad: number | null; chronicLoad: number | null; loadRatio: number | null; trainingStatus: string | null } {
  const byDevice = res?.mostRecentTrainingStatus?.latestTrainingStatusData ?? {};
  const entries: any[] = Object.values(byDevice);
  const e = entries.find((x) => x?.primaryTrainingDevice) ?? entries[0];
  const acwr = e?.acuteTrainingLoadDTO ?? {};
  const phrase = typeof e?.trainingStatusFeedbackPhrase === "string" ? e.trainingStatusFeedbackPhrase.replace(/_\d+$/, "") : null;
  return {
    acuteLoad: num(acwr.dailyTrainingLoadAcute),
    chronicLoad: num(acwr.dailyTrainingLoadChronic),
    loadRatio: num(acwr.dailyAcuteChronicWorkloadRatio, 2),
    trainingStatus: phrase,
  };
}

export function mapLaps(splits: any): Lap[] {
  const laps: any[] = splits?.lapDTOs ?? [];
  return laps.map((l) => ({ distanceM: Number(l.distance ?? 0), durationS: Number(l.movingDuration ?? l.duration ?? 0), avgHr: l.averageHR ?? null }));
}

export function mapWellness(date: string, parts: { hrv?: any; sleep?: any; bb?: any[]; readiness?: any[]; summary?: any; status?: any }): Wellness {
  const bbDay = (parts.bb ?? []).find((d) => d?.date === date) ?? (parts.bb ?? [])[0];
  const values: number[] = (bbDay?.bodyBatteryValuesArray ?? []).map((v: any[]) => v?.[1]).filter((v: any) => typeof v === "number");
  return {
    date,
    hrvAvg: parts.hrv?.hrvSummary?.lastNightAvg ?? null,
    hrvStatus: parts.hrv?.hrvSummary?.status ?? null,
    sleepScore: parts.sleep?.dailySleepDTO?.sleepScores?.overall?.value ?? null,
    bodyBatteryHigh: values.length ? Math.max(...values) : (bbDay?.charged ?? null),
    readiness: parts.readiness?.[0]?.score ?? null,
    restingHr: parts.summary?.restingHeartRate ?? null,
    ...(parts.status ? mapTrainingStatus(parts.status) : {}),
  };
}
