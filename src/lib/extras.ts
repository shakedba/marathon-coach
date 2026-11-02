/**
 * Strength & mobility program (approved 1 Nov 2026).
 * Equipment: dumbbells, pull-up bar, resistance band.
 *
 * Phase 1 (to Haifa): low dose, bodyweight only (squats/lunges OK per athlete, 1 Nov; no added weight in the taper).
 * Phase 2 (recovery): habit, still light.
 * Phase 3 (Tel Aviv build): Tue = heavier session (B), Thu = light core/hips (C); 1/week in cutback + taper,
 * none in the last 10 days before a race. Mobility after every run.
 */
import { addDays, diffDays, weekStart, weekday } from "./dates";
import { planFor, RACES } from "./plan";
import type { Text, Workout } from "./types";

export type ExtraKind = "strength" | "mobility";

export interface Exercise {
  id: string; // key into exercise-guide.ts (drawing + how-to)
  name: Text;
  dose: Text; // e.g. "12" / "30 s each side"
  note?: Text;
}

export interface Extra {
  date: string;
  kind: ExtraKind;
  id: string; // stable id, e.g. "A", "A1", "C", "B", "MOB"
  title: Text;
  minutes: number;
  rounds: number;
  exercises: Exercise[];
  note?: Text;
}

const t = (en: string, he: string): Text => ({ en, he });
const ex = (id: string, en: string, he: string, doseEn: string, doseHe: string, note?: Text): Exercise => ({ id, name: t(en, he), dose: t(doseEn, doseHe), note });

const RULE = t(
  "Finish feeling you could do more (effort 5/10). Sore the next day = too much, scale down.",
  "לסיים בתחושה שיכולת עוד (מאמץ 5/10). כאב שרירים למחרת = יותר מדי, להוריד מינון.",
);

// ---------- sessions ----------
const A_EXERCISES: Exercise[] = [
  ex("squat", "Bodyweight squat", "סקוואט במשקל גוף", "10", "10"),
  ex("reverse-lunge", "Reverse lunge (bodyweight)", "לאנג' אחורי (משקל גוף)", "8 each leg", "8 לכל רגל"),
  ex("glute-bridge", "Glute bridge (single-leg if easy)", "גשר ישבן (על רגל אחת אם קל)", "12", "12"),
  ex("calf-raise", "Slow calf raises: straight + bent knee", "הרמות עקב איטיות: ישרה + ברך כפופה", "15 + 15", "15 + 15"),
  ex("side-plank", "Side plank", "פלאנק צד", "30 s each side", "30 שנ' לכל צד"),
  ex("dead-bug", "Dead bug", "Dead bug", "8 each side", "8 לכל צד"),
  ex("clamshell", "Clamshell with band", "Clamshell עם גומייה", "12 each side", "12 לכל צד"),
  ex("bird-dog", "Bird dog", "Bird dog", "8 each side", "8 לכל צד"),
];

const C_EXERCISES: Exercise[] = [
  ex("glute-bridge", "Glute bridge", "גשר ישבן", "12", "12"),
  ex("side-plank", "Side plank", "פלאנק צד", "30 s each side", "30 שנ' לכל צד"),
  ex("dead-bug", "Dead bug", "Dead bug", "8 each side", "8 לכל צד"),
  ex("monster-walk", "Band monster walk", "הליכת מפלצת עם גומייה", "10 steps each way", "10 צעדים לכל כיוון"),
  ex("bird-dog", "Bird dog", "Bird dog", "8 each side", "8 לכל צד"),
];

const B_EXERCISES: Exercise[] = [
  ex("bulgarian", "Bulgarian split squat with dumbbells", "סקוואט בולגרי עם משקולות", "3 × 8 each leg", "3 × 8 לכל רגל"),
  ex("step-up", "Step-up onto bench/chair, dumbbells", "עלייה על ספסל/כיסא עם משקולות", "3 × 8 each leg", "3 × 8 לכל רגל"),
  ex("sl-rdl", "Single-leg Romanian deadlift, dumbbell", "דדליפט רומני על רגל אחת עם משקולת", "3 × 8 each leg", "3 × 8 לכל רגל"),
  ex("hip-thrust", "Hip thrust (dumbbell on hips)", "היפ תראסט (משקולת על האגן)", "3 × 10", "3 × 10"),
  ex("calf-raise", "Single-leg calf raise holding a dumbbell", "הרמת עקב על רגל אחת עם משקולת", "3 × 12 each leg", "3 × 12 לכל רגל"),
  ex("pull-up", "Pull-ups (band-assisted if needed)", "מתח (בעזרת גומייה אם צריך)", "3 × max-2", "3 × מקסימום פחות 2"),
  ex("copenhagen", "Copenhagen plank (short lever)", "Copenhagen plank (גרסה קצרה)", "3 × 20 s each side", "3 × 20 שנ' לכל צד"),
];

const PLYO: Exercise[] = [
  ex("pogo", "Pogo hops", "קפיצות קרסול (pogo)", "2 × 20", "2 × 20"),
  ex("a-skip", "A-skips", "סקיפים", "2 × 20 m", "2 × 20 מ'"),
];

const MOBILITY: Exercise[] = [
  ex("hip-flexor", "Hip-flexor lunge stretch", "מתיחת כופף ירך בלאנג'", "45 s each side", "45 שנ' לכל צד"),
  ex("calf-wall", "Calf on wall: straight + bent knee", "שוק ליד קיר: ישרה + כפופה", "45 s each", "45 שנ' כל אחת"),
  ex("hamstring-strap", "Hamstring, lying, with strap", "ירך אחורית בשכיבה עם רצועה", "45 s each side", "45 שנ' לכל צד"),
  ex("figure-4", "Figure-4 glute stretch", "ישבן בתנוחת 4", "45 s each side", "45 שנ' לכל צד"),
  ex("open-book", "Open book (upper back)", "Open book (גב עליון)", "8 each side", "8 לכל צד"),
  ex("knee-to-wall", "Knee-to-wall (ankle)", "ברך לקיר (קרסול)", "10 each side", "10 לכל צד"),
];

const sA = (date: string, rounds: number): Extra => ({
  date, kind: "strength", id: rounds === 1 ? "A1" : "A",
  title: t(`Strength A (bodyweight, ${rounds} round${rounds > 1 ? "s" : ""})`, `כוח A (משקל גוף, ${rounds === 1 ? "סבב אחד" : `${rounds} סבבים`})`),
  minutes: rounds === 1 ? 15 : 25, rounds, exercises: A_EXERCISES, note: RULE,
});
const sC = (date: string): Extra => ({
  date, kind: "strength", id: "C",
  title: t("Core & hips (light)", "ליבה וירכיים (קל)"),
  minutes: 15, rounds: 2, exercises: C_EXERCISES, note: t("No leg exercises to fatigue.", "בלי תרגילי רגליים עד עייפות."),
});
const sB = (date: string, plyo: boolean): Extra => ({
  date, kind: "strength", id: plyo ? "B+P" : "B",
  title: t("Strength B (dumbbells)", "כוח B (משקולות)"),
  minutes: plyo ? 40 : 35, rounds: 1,
  exercises: plyo ? [...PLYO, ...B_EXERCISES] : B_EXERCISES,
  note: t(
    "Weight: last 2 reps hard but clean. Add weight when all sets feel easy. After the run, not before.",
    "משקל: 2 החזרות האחרונות קשות אבל נקיות. מעלים משקל כשכל הסטים קלים. אחרי הריצה, לא לפני.",
  ),
});
const mobility = (date: string, light: boolean): Extra => ({
  date, kind: "mobility", id: "MOB",
  title: light ? t("Mobility (light, 5 min)", "גמישות (קלה, 5 דק')") : t("Mobility after the run (10 min)", "גמישות אחרי הריצה (10 דק')"),
  minutes: light ? 5 : 10, rounds: 1, exercises: MOBILITY,
  note: t("Before runs: 3 min dynamic (leg swings, ankle circles). No long static stretches before quality runs.", "לפני ריצה: 3 דק' דינמי (הנפות רגל, סיבובי קרסול). בלי מתיחות סטטיות ארוכות לפני אימוני איכות."),
});

// ---------- schedule ----------
const HAIFA = RACES[0].date; // 2026-11-20
const TLV = RACES[1].date; // 2027-02-26
const TLV_BUILD = "2026-12-07";
const TLV_CUTBACK_WEEKS = new Set(["2027-01-11"]);
const TLV_TAPER_WEEKS = new Set(["2027-02-08", "2027-02-15"]);
const PLYO_FROM = "2027-01-04";

/** No strength in the last 10 days before either race. */
function nearRace(date: string): boolean {
  return RACES.some((r) => {
    const d = diffDays(r.date, date);
    return d >= 0 && d < 10;
  });
}

export function strengthFor(date: string): Extra | null {
  const wd = weekday(date); // 2 = Tue, 4 = Thu
  if (wd !== 2 && wd !== 4) return null;
  if (nearRace(date)) return null;
  const ws = weekStart(date);
  // Phase 1: to Haifa
  if (date >= "2026-11-02" && date <= HAIFA) {
    if (ws === "2026-11-02") return wd === 2 ? sA(date, 2) : sC(date);
    if (ws === "2026-11-09") return wd === 2 ? sA(date, 1) : null;
    return null;
  }
  // Phase 2: recovery (A twice a week from the 2nd week after Haifa)
  if (date > HAIFA && date < TLV_BUILD) {
    return date >= "2026-11-30" ? sA(date, 2) : null;
  }
  // Phase 3: Tel Aviv build
  if (date >= TLV_BUILD && date <= TLV) {
    const oneOnly = TLV_CUTBACK_WEEKS.has(ws) || TLV_TAPER_WEEKS.has(ws);
    if (wd === 4) return oneOnly ? null : sC(date);
    return sB(date, date >= PLYO_FROM);
  }
  return null;
}

/** Mobility after every run day; a light version in race week and on rest days in recovery. */
export function mobilityFor(date: string, run: Workout): Extra | null {
  if (run.type === "race") return null;
  const raceWeek = RACES.some((r) => {
    const d = diffDays(r.date, date);
    return d > 0 && d < 7;
  });
  if (run.type === "rest") return date > HAIFA && date < TLV_BUILD ? mobility(date, true) : null;
  return mobility(date, raceWeek);
}

export function extrasFor(date: string, overrides: Record<string, Workout>): Extra[] {
  const run = planFor(date, overrides);
  return [strengthFor(date), mobilityFor(date, run)].filter((x): x is Extra => !!x);
}

export function extrasWeek(monday: string, overrides: Record<string, Workout>): Record<string, Extra[]> {
  const out: Record<string, Extra[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    out[d] = extrasFor(d, overrides);
  }
  return out;
}

/** Show a caution on strength when the athlete reported illness/fever/niggle in the last 3 days. */
export function strengthCaution(recentSkips: { date: string; reason?: string }[], today: string): Text | null {
  const r = recentSkips.filter((s) => diffDays(today, s.date) <= 3 && diffDays(today, s.date) >= 0);
  if (r.some((s) => s.reason === "fever" || s.reason === "ill")) {
    return t("You reported being ill recently: skip strength until 24h symptom-free.", "דיווחת על מחלה לאחרונה: לדלג על הכוח עד 24 שעות בלי תסמינים.");
  }
  if (r.some((s) => s.reason === "niggle")) {
    return t("You reported a niggle: core and upper body only, no leg exercises.", "דיווחת על כאב: רק ליבה ופלג גוף עליון, בלי תרגילי רגליים.");
  }
  return null;
}

export const TLV_DATES = { TLV, TLV_BUILD };
