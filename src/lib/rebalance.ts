import { addDays } from "./dates";
import { isRaceWeek, isTaper } from "./plan";
import type { Activity, Change, DayStatus, Proposal, SkipReason, Step, Text, Workout } from "./types";

const t = (en: string, he: string): Text => ({ en, he });
const HARD = new Set(["mp", "fast", "tempo", "intervals", "hills", "race", "long"]);
const isHard = (w: Workout) => HARD.has(w.type);
const isRun = (w: Workout) => w.type !== "rest";
const round05 = (x: number) => Math.round(x * 2) / 2;

function rest(date: string, notes?: Text): Workout {
  return { date, type: "rest", km: 0, title: t("Rest", "מנוחה"), key: false, notes };
}

function easyVersion(w: Workout, factor: number, note: Text): Workout {
  const km = Math.max(5, round05(w.km * factor));
  return {
    date: w.date,
    type: "easy",
    km,
    pace: [330, 345],
    hrCap: 145,
    key: false,
    title: t(`${km} km easy`, `${km} ק"מ קל`),
    notes: note,
    steps: [{ kind: "active", distM: km * 1000, pace: [330, 345], hrMax: 145 }],
  };
}

function scaleSteps(steps: Step[], f: number): Step[] {
  return steps.map((s) => {
    if (s.kind === "repeat") return { ...s, times: Math.max(1, Math.round(s.times * f)) };
    if (s.kind === "active" && s.distM) return { ...s, distM: Math.round((s.distM * f) / 500) * 500 };
    return s;
  });
}

/** Shorten a workout to roughly `f` of its volume, keeping its character. */
export function scaleWorkout(w: Workout, f: number, date = w.date): Workout {
  const km = round05(w.km * f);
  return {
    ...w,
    date,
    km,
    steps: w.steps ? scaleSteps(w.steps, f) : undefined,
    title: { en: `${w.title.en} (shortened)`, he: `${w.title.he} (מקוצר)` },
  };
}

export type DayState = "done" | "moved" | "partial" | "missed" | "skipped" | "extra" | "rest" | "today" | "future";

export interface DayMatch {
  date: string;
  plan: Workout;
  activities: Activity[];
  actualKm: number;
  state: DayState;
  status?: DayStatus;
}

const RUN_SPORTS = /run/i;

/** Match a week's plan against what was actually run. */
export function matchWeek(plan: Workout[], activities: Activity[], statuses: Record<string, DayStatus>, today: string): DayMatch[] {
  const days: DayMatch[] = plan.map((p) => {
    const acts = activities.filter((a) => a.date === p.date && RUN_SPORTS.test(a.sport));
    const actualKm = Math.round(acts.reduce((s, a) => s + a.distanceM, 0) / 100) / 10;
    const status = statuses[p.date];
    let state: DayState;
    if (p.date > today) state = "future";
    else if (status?.status === "skipped") state = "skipped";
    else if (!isRun(p)) state = actualKm > 0 ? "extra" : "rest";
    else if (actualKm >= p.km * 0.7 || status?.status === "done") state = "done";
    else if (actualKm > 0) state = "partial";
    else if (p.date === today) state = "today";
    else state = "missed";
    return { date: p.date, plan: p, activities: acts, actualKm, state, status };
  });
  // A session run one day late/early on a rest day counts as moved, not missed.
  days.forEach((d, i) => {
    if (d.state !== "missed") return;
    for (const j of [i + 1, i - 1]) {
      const n = days[j];
      if (n && n.state === "extra" && n.actualKm >= d.plan.km * 0.7) {
        d.state = "moved";
        n.state = "moved";
        return;
      }
    }
  });
  return days;
}

/**
 * Rules (approved 31 Oct 2026):
 * 1. Never make up a missed session; never raise the week above its planned total.
 * 2. Missed easy run -> dropped.
 * 3. Missed key session -> moved once to a later easy day that week, shortened 20-25%; never two hard days in a row.
 * 4. Ill -> next 2 days easy only, week cut 25-30%. Fever -> rest until 24h symptom-free.
 * 5. Niggle -> easy only until it's gone, no hills/intervals.
 * 6. Last 3 weeks before a race: sessions are dropped, never added. Race week is locked.
 */
export function proposeRebalance(week: Workout[], missedDate: string, reason: SkipReason, today: string): Proposal {
  const weekStartDate = week[0].date;
  const missed = week.find((w) => w.date === missedDate);
  const base = { weekStart: weekStartDate, trigger: { date: missedDate, reason } };
  if (!missed) return { ...base, changes: [], summary: t("Nothing to change.", "אין מה לשנות.") };

  // Only days that are still in the future can change; "next 2 days" counts from the missed day, not from today.
  const firstOpen = missedDate >= today ? addDays(missedDate, 1) : today;
  const upcoming = week.filter((w) => w.date >= firstOpen && w.type !== "race");
  const nextTwo = (w: Workout) => w.date <= addDays(missedDate, 2);
  const changes: Change[] = [];
  const set = (to: Workout, why: Text) => {
    const from = week.find((w) => w.date === to.date)!;
    changes.push({ date: to.date, from, to, why });
  };

  if (isRaceWeek(missedDate)) {
    return { ...base, changes: [], summary: t("Race week is locked: the session is simply dropped.", "שבוע המרוץ נעול: האימון פשוט יורד.") };
  }

  if (reason === "fever") {
    upcoming.filter(nextTwo).forEach((w) => {
      if (isRun(w)) set(rest(w.date, t("Fever: no running until 24h symptom-free", "חום: בלי ריצה עד 24 שעות בלי תסמינים")), t("Fever rule", "כלל חום"));
    });
    upcoming.filter((w) => !nextTwo(w)).forEach((w) => {
      if (isHard(w)) set(easyVersion(w, 0.7, t("Back from fever: easy only this week", "חזרה מחום: רק קל השבוע")), t("Fever rule: week cut ~30%", "כלל חום: השבוע מקוצר ב-30%"));
    });
    return { ...base, changes, summary: t("Fever: rest 2 days, rest of the week easy and ~30% shorter.", "חום: יומיים מנוחה, שאר השבוע קל ומקוצר ב-30%.") };
  }

  if (reason === "ill") {
    upcoming.forEach((w) => {
      if (!isRun(w)) return;
      if (nextTwo(w)) {
        if (isHard(w) || w.km > 8) set(easyVersion(w, Math.min(1, 8 / w.km), t("Ill: easy only for 2 days", "חולה: רק קל ליומיים")), t("Illness rule", "כלל מחלה"));
      } else if (w.type === "long") {
        set(scaleWorkout(w, 0.75), t("Illness rule: week cut ~25%", "כלל מחלה: השבוע מקוצר ב-25%"));
      }
    });
    const easyDays = changes.some((c) => c.to.type === "easy");
    const summary = easyDays
      ? t("Ill: next 2 days easy, long run cut by 25%.", "חולה: היומיים הבאים קלים, הארוכה מקוצרת ב-25%.")
      : t("Ill: the illness days have passed; long run cut by 25%.", "חולה: ימי המחלה עברו; הארוכה מקוצרת ב-25%.");
    return { ...base, changes, summary };
  }

  if (reason === "niggle") {
    upcoming.forEach((w) => {
      if (w.type === "long") set(easyVersion(w, 0.7, t("Niggle: long run easy and shorter", "כאב: ארוכה קלה וקצרה")), t("Niggle rule", "כלל כאב"));
      else if (isHard(w)) set(easyVersion(w, 0.8, t("Niggle: no quality until it's gone", "כאב: בלי איכות עד שעובר")), t("Niggle rule", "כלל כאב"));
    });
    return { ...base, changes, summary: t("Niggle: easy only until it's gone. Stop if it gets worse.", "כאב: רק קל עד שעובר. לעצור אם מחמיר.") };
  }

  // time / tired
  if (!missed.key) {
    return { ...base, changes: [], summary: t("Easy run missed: dropped, no make-up.", "ריצה קלה שהוחמצה: יורדת, בלי השלמה.") };
  }
  if (isTaper(missedDate)) {
    return { ...base, changes: [], summary: t("Taper: missed sessions are dropped, never added back.", "טייפר: אימונים שהוחמצו יורדים, לא מוסיפים.") };
  }
  if (missed.notes?.en.startsWith("Moved from")) {
    return { ...base, changes: [], summary: t("Already moved once: dropped.", "כבר הוזז פעם אחת: יורד.") };
  }

  const effective = (date: string) => changes.find((c) => c.date === date)?.to ?? week.find((w) => w.date === date);
  const candidate = upcoming.find((w) => {
    if (w.type !== "easy" && w.type !== "medium") return false;
    const before = effective(addDays(w.date, -1));
    const after = effective(addDays(w.date, 1));
    const beforeHard = before && before.date !== missedDate && isHard(before);
    return !beforeHard && !(after && isHard(after));
  });
  if (!candidate) {
    return { ...base, changes: [], summary: t("No safe slot this week (would mean back-to-back hard days): dropped.", "אין מקום בטוח השבוע (שני ימים קשים ברצף): יורד.") };
  }
  const factor = reason === "tired" ? 0.75 : 0.8;
  const moved = scaleWorkout(missed, factor, candidate.date);
  moved.notes = t(`Moved from ${missedDate}, shortened ${Math.round((1 - factor) * 100)}%`, `הוזז מ-${missedDate}, מקוצר ${Math.round((1 - factor) * 100)}%`);
  set(moved, t("Key session moved once to an easy day", "אימון מפתח הוזז פעם אחת ליום קל"));
  return { ...base, changes, summary: t(`Key session moved to ${candidate.date} and shortened.`, `אימון המפתח הוזז ל-${candidate.date} וקוצר.`) };
}

export function weekKm(week: Workout[]): number {
  return Math.round(week.reduce((s, w) => s + (w.type === "race" ? 0 : w.km), 0) * 10) / 10;
}
