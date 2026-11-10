import { addDays } from "./dates";
import type { PaceRange, RaceInfo, Step, Text, Workout, WorkoutType } from "./types";

/** Pace zones from the original plan sheet (sec/km). */
export const P = {
  longEasy: 344, // 5:44
  easy: 329, // 5:29
  medium: 322, // 5:22
  fastVolume: 324, // 5:24
  mp: 310, // 5:10
  fast: 296, // 4:56
  tempo: 291, // 4:51
  longInt: 279, // 4:39
  shortInt: 269, // 4:29
  hills: 304, // 5:04
  wu: [330, 390] as PaceRange, // warm-up / cool-down 5:30-6:30
};

const around = (p: number, spread = 5): PaceRange => [p - spread, p + spread];
const EASY_TAPER: PaceRange = [330, 340];

export const RACES: RaceInfo[] = [
  { id: "haifa-2026", name: { en: "Haifa Marathon", he: "מרתון חיפה" }, date: "2026-11-20", startTime: "06:30", goalPace: 310, goalTime: "3:38:00" },
  { id: "tlv-2027", name: { en: "Tel Aviv Marathon", he: "מרתון תל אביב" }, date: "2027-02-26", startTime: "06:00" },
];

// ---------- builders ----------
type W = Omit<Workout, "date">;
const t = (en: string, he: string): Text => ({ en, he });
const wuStep = (km = 2): Step => ({ kind: "warmup", distM: km * 1000, pace: P.wu });
const cdStep = (km = 2): Step => ({ kind: "cooldown", distM: km * 1000, pace: P.wu });

function run(type: WorkoutType, km: number, pace: PaceRange, en: string, he: string, extra: Partial<W> = {}): W {
  return {
    type,
    km,
    pace,
    title: t(en, he),
    key: type !== "easy" && type !== "medium",
    steps: [{ kind: "active", distM: km * 1000, pace, hrMax: extra.hrCap }],
    ...extra,
  };
}
const easy = (km: number, pace: PaceRange = around(P.easy), extra: Partial<W> = {}) =>
  run("easy", km, pace, `${km} km easy`, `${km} ק"מ קל`, extra);
const medium = (km: number) => run("medium", km, around(P.medium), `${km} km medium`, `${km} ק"מ בינוני`);
const long = (km: number, pace = P.longEasy) => run("long", km, around(pace), `${km} km long run`, `${km} ק"מ ריצה ארוכה`);
const mpRun = (km: number) => run("mp", km, around(P.mp, 3), `${km} km @ marathon pace`, `${km} ק"מ בקצב מרתון`);
const fastRun = (km: number) => run("fast", km, around(P.fast), `${km} km fast`, `${km} ק"מ מהיר`);
const rest = (): W => ({ type: "rest", km: 0, title: t("Rest", "מנוחה"), key: false });

function reps(type: "intervals" | "hills", n: number, m: number, pace: number, en: string, he: string): W {
  const km = 4 + (n * m * 2) / 1000;
  return {
    type,
    km: Math.round(km * 10) / 10,
    pace: around(pace),
    title: t(en, he),
    key: true,
    notes: t("2 km warm-up + 2 km cool-down at 5:30-6:30", "2 ק\"מ חימום + 2 ק\"מ שחרור ב-5:30-6:30"),
    steps: [
      wuStep(),
      { kind: "repeat", times: n, steps: [{ kind: "active", distM: m, pace: around(pace) }, { kind: "recovery", distM: m, pace: P.wu }] },
      cdStep(),
    ],
  };
}
const ints = (n: number, m: number, pace: number) =>
  reps("intervals", n, m, pace, `${n}×${m >= 1000 ? m / 1000 + " km" : m + " m"} intervals`, `אינטרוולים ${n}×${m >= 1000 ? m / 1000 + ' ק"מ' : m + " מ'"}`);
const hills = (n: number, m: number) => reps("hills", n, m, P.hills, `Hills ${n}×${m} m`, `עליות ${n}×${m} מ'`);
function tempo(km: number): W {
  return {
    type: "tempo",
    km: km + 4,
    pace: around(P.tempo),
    title: t(`Tempo ${km} km`, `טמפו ${km} ק"מ`),
    key: true,
    steps: [wuStep(), { kind: "active", distM: km * 1000, pace: around(P.tempo) }, cdStep()],
  };
}
function race(km: number, en: string, he: string, pace?: number): W {
  return { type: "race", km, title: t(en, he), key: true, pace: pace ? around(pace, 3) : undefined };
}
/** warm-up + block at pace + cool-down */
function block(total: number, wu: number, blockKm: number, pace: number, type: WorkoutType, en: string, he: string, hrCap?: number, notes?: Text): W {
  const cd = Math.round((total - wu - blockKm) * 10) / 10;
  return {
    type,
    km: total,
    pace: around(pace, 3),
    hrCap,
    title: t(en, he),
    key: true,
    notes,
    steps: [
      { kind: "warmup", distM: wu * 1000, pace: wu > 3 ? EASY_TAPER : P.wu },
      { kind: "active", distM: blockKm * 1000, pace: around(pace, 3), hrMax: hrCap },
      ...(cd > 0 ? [{ kind: "cooldown", distM: cd * 1000, pace: P.wu } as Step] : []),
    ],
  };
}

/** Week layout: [Mon, Tue, Wed, Thu, Fri, Sat, Sun] */
function week(monday: string, days: W[]): Workout[] {
  return days.map((d, i) => ({ ...d, date: addDays(monday, i) }));
}
const R = rest;

// ---------- Haifa 2026: 18 weeks from Mon 20 Jul ----------
const HAIFA_START = "2026-07-20";
const wk = (n: number) => addDays(HAIFA_START, (n - 1) * 7);

const haifaWeeks: Workout[][] = [
  week(wk(1), [easy(10), ints(6, 400, P.shortInt), easy(8), R(), mpRun(10), long(16), R()]),
  week(wk(2), [easy(10), hills(5, 400), easy(10), R(), mpRun(10), long(18), R()]),
  week(wk(3), [easy(10), ints(5, 600, P.shortInt), easy(8), R(), mpRun(12), long(20), R()]),
  week(wk(4), [easy(8), ints(8, 400, P.shortInt), fastRun(8), R(), mpRun(12), long(16, P.fastVolume), R()]),
  week(wk(5), [easy(10), tempo(4), medium(10), R(), mpRun(14), long(22, P.fastVolume), R()]),
  week(wk(6), [easy(10), ints(8, 600, P.shortInt), medium(10), R(), mpRun(14), long(26, P.fastVolume), R()]),
  week(wk(7), [medium(12), hills(6, 400), easy(12), R(), race(10, "10K race", "תחרות 10 ק\"מ", 284), long(28), R()]),
  week(wk(8), [medium(10), ints(6, 800, P.longInt), easy(10), R(), tempo(6), long(20, P.fastVolume), R()]),
  week(wk(9), [medium(10), hills(8, 500), easy(10), R(), mpRun(16), long(30, P.fastVolume), R()]),
  week(wk(10), [medium(14), ints(6, 1000, P.longInt), easy(10), R(), easy(20), race(15, "15K race", "תחרות 15 ק\"מ", 295), R()]),
  week(wk(11), [medium(10), mpRun(16), easy(10), R(), tempo(6), long(32, P.fastVolume), R()]),
  week(wk(12), [medium(10), ints(4, 800, P.longInt), medium(8), R(), mpRun(12), long(35), R()]),
  week(wk(13), [medium(10), ints(8, 1000, P.longInt), mpRun(12), R(), easy(16), long(37), R()]),
  week(wk(14), [easy(10), tempo(4), R(), race(21.1, "Half marathon (tune-up)", "חצי מרתון (תחרות הכנה)", 299), easy(12), long(25), R()]),
  week(wk(15), [medium(10), easy(14), fastRun(8), R(), mpRun(18), long(35), R()]),
  // ---- Approved taper (31 Oct 2026) ----
  week(wk(16), [
    easy(10, EASY_TAPER, { hrCap: 145, notes: t("Rest instead if fever or feeling worse", "מנוחה במקום אם יש חום או הרגשה רעה") }),
    hills(5, 400),
    // Adjusted 4 Nov 2026 (approved): Wed MP missed (early office day). Taper: not made up; MP stays in Saturday's long run.
    // Thu easy keeps run frequency; Fri cut to 6 to protect the last long run.
    { ...R(), notes: t("MP session dropped (taper: not made up). Marathon pace is in Saturday's long run.", "אימון קצב המרתון ירד (טייפר: לא משלימים). קצב מרתון נמצא בארוכה של שבת.") },
    easy(8, EASY_TAPER, { hrCap: 145, notes: t("Truly easy: HR ≤145 even if that means 5:45+/km. Optional 4×20 s strides at the end.", "קל באמת: דופק ≤145 גם אם זה 5:45+. אופציונלי: 4 האצות של 20 שנ' בסוף.") }),
    easy(6, EASY_TAPER, { hrCap: 145, notes: t("Short and easy - protects tomorrow's long run.", "קצר וקל - שומר על הארוכה של מחר.") }),
    {
      ...block(24, 16, 8, P.mp, "long", "Last long run: 16 easy + 8 @ MP", "ריצה ארוכה אחרונה: 16 קל + 8 בקצב מרתון", 160),
      notes: t("Race rehearsal: race breakfast, GO Isotonic gel 15 min before + every 25 min. MP 5:07-5:13 - not faster.", "חזרה גנרלית: ארוחת בוקר של תחרות, ג'ל GO Isotonic רבע שעה לפני + כל 25 דק'. קצב מרתון 5:07-5:13 - לא מהר יותר."),
    },
    R(),
  ]),
  week(wk(17), [
    easy(10, EASY_TAPER, { hrCap: 145 }),
    block(12, 2, 6, P.mp, "mp", "2 wu + 6 km @ MP + 4 easy", "2 חימום + 6 ק\"מ בקצב מרתון + 4 קל", 160),
    // Adjusted 4 Nov 2026 (approved): hard-easy-hard (Tue MP, Thu fast, Sat long); no quality the day before the long run.
    // Adjusted 10 Nov 2026 (approved): full rest, the optional run is dropped.
    { ...R(), notes: t("Full rest - no optional run this week.", "מנוחה מלאה - בלי ריצה אופציונלית השבוע.") },
    {
      type: "fast",
      km: 8,
      pace: around(P.fast, 5),
      title: t("3×1 km @ 4:55 (8 km total)", "3×1 ק\"מ ב-4:55 (8 ק\"מ סה\"כ)"),
      key: true,
      notes: t(
        "Readiness check: if HRV is low/unbalanced, resting HR is 5+ above normal, or legs feel heavy in the warm-up -> 6 km easy + 4x20 s strides instead.",
        "בדיקה לפני: אם סטטוס ה-HRV ב-Garmin נמוך/לא מאוזן, דופק המנוחה בבוקר גבוה ב-5+ מהרגיל, או שהרגליים כבדות בחימום - במקום זה 6 ק\"מ קל + 4 האצות של 20 שנ'.",
      ),
      steps: [wuStep(), { kind: "repeat", times: 3, steps: [{ kind: "active", distM: 1000, pace: [292, 298] }, { kind: "recovery", distM: 500, pace: P.wu }] }, cdStep(1.5)],
    },
    easy(6, EASY_TAPER, { hrCap: 145, notes: t("Easy day before the long run: not faster than 5:30, effort 3-4/10 (you can talk in full sentences).", "יום קל לפני הארוכה: לא מהר מ-5:30, מאמץ 3-4/10 (אפשר לדבר במשפטים מלאים).") }),
    {
      ...block(14, 11, 3, P.mp, "long", "14 km easy, last 3 @ MP", "14 ק\"מ קל, 3 אחרונים בקצב מרתון", 155),
      notes: t("Last 3 km at marathon pace - not faster than 5:10.", "3 ק\"מ אחרונים בקצב מרתון - לא מהר מ-5:10."),
    },
    R(),
  ]),
  week(wk(18), [
    { ...easy(8, EASY_TAPER, { hrCap: 145 }), title: t("8 km easy + 4 strides", "8 ק\"מ קל + 4 האצות") },
    // Adjusted 4 Nov 2026 (approved): Wednesday run moved to Tuesday; race eve stays rest.
    { ...block(6, 2, 2, P.mp, "easy", "6 km easy incl. 2 km @ MP", "6 ק\"מ קל כולל 2 ק\"מ בקצב מרתון"), key: false },
    { ...R(), notes: t("Optional: 20 min very easy if you're home.", "אופציונלי: 20 דק' קל מאוד אם אתה בבית.") },
    { ...R(), notes: t("Bib + gels ready", "מספר חזה + ג'לים מוכנים") },
    {
      ...race(42.2, "HAIFA MARATHON - solo, 06:30", "מרתון חיפה - לבד, 06:30", P.mp),
      notes: t("03:45 wake / 04:00 breakfast / 06:15 gel. See race plan.", "03:45 השכמה / 04:00 ארוחת בוקר / 06:15 ג'ל. ראה תוכנית מרוץ."),
    },
    R(),
    R(),
  ]),
];

export const HAIFA_PLAN: Workout[] = haifaWeeks.flat();

/** Tel Aviv 2027 outline (day-level plan is written after Haifa). */
export const TLV_OUTLINE: { weekStart: string; phase: Text; km: number; key: Text }[] = [
  { weekStart: "2026-11-23", phase: t("Recovery", "התאוששות"), km: 15, key: t("No running until Tue, then 3×25-40 min easy", "בלי ריצה עד שלישי, אז 3×25-40 דק' קל") },
  { weekStart: "2026-11-30", phase: t("Recovery", "התאוששות"), km: 35, key: t("Easy only, 4 runs", "רק קל, 4 ריצות") },
  { weekStart: "2026-12-07", phase: t("Return", "חזרה"), km: 45, key: t("5 days, strides, long 16", "5 ימים, האצות, ארוכה 16") },
  { weekStart: "2026-12-14", phase: t("Rebuild", "בנייה מחדש"), km: 55, key: t("First intervals, long 20", "אינטרוולים ראשונים, ארוכה 20") },
  { weekStart: "2026-12-21", phase: t("Build", "בנייה"), km: 62, key: t("Tempo, long 24", "טמפו, ארוכה 24") },
  { weekStart: "2026-12-28", phase: t("Build", "בנייה"), km: 70, key: t("Long intervals, long 26", "אינטרוולים ארוכים, ארוכה 26") },
  { weekStart: "2027-01-04", phase: t("Build", "בנייה"), km: 75, key: t("MP 14, long 28", "קצב מרתון 14, ארוכה 28") },
  { weekStart: "2027-01-11", phase: t("Cutback", "הורדה"), km: 62, key: t("Long 20", "ארוכה 20") },
  { weekStart: "2027-01-18", phase: t("Build", "בנייה"), km: 80, key: t("MP 16, long 32", "קצב מרתון 16, ארוכה 32") },
  { weekStart: "2027-01-25", phase: t("Checkpoint", "נקודת בדיקה"), km: 75, key: t("Tune-up half -> set target", "חצי הכנה -> קביעת יעד") },
  { weekStart: "2027-02-01", phase: t("Peak", "שיא"), km: 88, key: t("Long 34-35 with MP finish", "ארוכה 34-35 עם סיום בקצב מרתון") },
  { weekStart: "2027-02-08", phase: t("Taper", "טייפר"), km: 65, key: t("Long 24", "ארוכה 24") },
  { weekStart: "2027-02-15", phase: t("Taper", "טייפר"), km: 50, key: t("Long 14", "ארוכה 14") },
  { weekStart: "2027-02-22", phase: t("Race", "מרוץ"), km: 57, key: t("Race Fri 26 Feb", "מרוץ שישי 26 בפברואר") },
];

export const HAIFA_RACE_PLAN = [
  // HR is a sanity check only: the wrist sensor is unreliable for this athlete (10 Nov 2026). Pace + effort lead.
  { km: "1-5", pace: "5:18-5:20", hr: "≤152", cum: "~26:30" },
  { km: "5-21.1", pace: "5:12-5:15", hr: "≤158", cum: "~1:50 @ half" },
  { km: "21-32", pace: "5:10", hr: "≤163", cum: "" },
  { km: "32-42.2", pace: "by feel / push", hr: "-", cum: "3:38-3:41" },
];

const byDate = new Map(HAIFA_PLAN.map((w) => [w.date, w]));

/** Base plan for a date (before overrides). Unknown dates are rest. */
export function basePlanFor(date: string): Workout {
  return byDate.get(date) ?? { date, type: "rest", km: 0, title: t("Rest", "מנוחה"), key: false };
}

/** Apply accepted overrides (date -> workout). */
export function planFor(date: string, overrides: Record<string, Workout>): Workout {
  return overrides[date] ?? basePlanFor(date);
}

export function planWeek(monday: string, overrides: Record<string, Workout>): Workout[] {
  return Array.from({ length: 7 }, (_, i) => planFor(addDays(monday, i), overrides));
}

/** Last 3 weeks before a race: never add load. */
export function isTaper(date: string): boolean {
  return RACES.some((r) => {
    const d = Date.parse(r.date) - Date.parse(date);
    return d >= 0 && d <= 21 * 86400000;
  });
}

export function isRaceWeek(date: string): boolean {
  return RACES.some((r) => {
    const d = Date.parse(r.date) - Date.parse(date);
    return d >= 0 && d < 7 * 86400000;
  });
}
