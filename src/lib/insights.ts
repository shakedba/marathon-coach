/**
 * Coach insights (layer 1): deterministic rules over the athlete's own data, no outside services.
 * Every insight carries the numbers it rests on (evidence) and, where it uses outside knowledge, a source.
 * Pace and effort lead; wrist HR is never used during runs. Overnight readings (resting HR, HRV status, sleep) are a
 * secondary signal, compared only with the athlete's own recent baseline.
 */
import { analyzeRun, mainRun, RPE_SINCE, type Analysis } from "./analysis";
import { addDays, diffDays, fmtDuration, fmtPace, weekday, weekStart } from "./dates";
import type { EvidenceKey } from "./evidence";
import { predictMarathon } from "./metrics";
import { RACES } from "./plan";
import type { DayMatch } from "./rebalance";
import type { Activity, Text, Wellness } from "./types";

const t = (en: string, he: string): Text => ({ en, he });
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
const DOW_HE = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const QUALITY = new Set(["mp", "tempo", "fast", "intervals", "hills", "long", "race", "medium"]);

export type InsightLevel = "warn" | "good" | "info";
export interface Insight {
  id: string;
  level: InsightLevel;
  scope: "today" | "week" | "race" | "pattern";
  title: Text;
  body: Text;
  evidence?: string;
  source?: EvidenceKey;
  action?: { href: string; label: Text };
}

export interface InsightInput {
  today: string;
  /** DayMatch for every day of the last ~8 weeks through the end of this week. */
  days: DayMatch[];
  /** All activities in the same window (for race results). */
  acts: Activity[];
  /** Wellness rows for the last ~21 days. */
  wellness: Wellness[];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

/** Per-run analysis for days up to today (effort only from RPE_SINCE, same rule as the app). */
function analyzed(days: DayMatch[], today: string): { day: DayMatch; a: Analysis }[] {
  const out: { day: DayMatch; a: Analysis }[] = [];
  for (const d of days) {
    if (d.date > today) continue;
    const run = mainRun(d.activities);
    if (!run) continue;
    out.push({ day: d, a: analyzeRun(d.plan, run, d.date >= RPE_SINCE ? d.status?.feel ?? null : undefined) });
  }
  return out;
}

export function readinessInsight(input: InsightInput): Insight | null {
  const { today, wellness, days } = input;
  const w = wellness.find((x) => x.date === today);
  if (!w || (w.restingHr == null && !w.hrvStatus && w.sleepScore == null)) return null;
  const base = wellness.filter((x) => x.date < today && x.date >= addDays(today, -14) && x.restingHr != null).map((x) => x.restingHr as number);
  const reasons: { en: string; he: string; warn: boolean }[] = [];
  if (w.restingHr != null && base.length >= 5) {
    const delta = Math.round(w.restingHr - median(base));
    if (delta >= 5) reasons.push({ en: `resting HR ${w.restingHr} (+${delta} vs your 14-day median)`, he: `דופק מנוחה ${w.restingHr} (+${delta} מהחציון שלך ב-14 יום)`, warn: true });
  }
  if (w.hrvStatus && /LOW|POOR|UNBALANCED/i.test(w.hrvStatus)) reasons.push({ en: `HRV ${w.hrvStatus.toLowerCase()}`, he: `HRV ${w.hrvStatus.toLowerCase()}`, warn: true });
  if (w.sleepScore != null && w.sleepScore < 50) reasons.push({ en: `sleep score ${w.sleepScore}`, he: `ציון שינה ${w.sleepScore}`, warn: true });
  const todayMatch = days.find((d) => d.date === today);
  const plan = todayMatch?.plan;
  const ranToday = (todayMatch?.activities.length ?? 0) > 0;
  const qualityToday = !ranToday && !!plan && plan.key && QUALITY.has(plan.type) && plan.type !== "race";
  const evidence = [
    w.restingHr != null ? `RHR ${w.restingHr}${base.length >= 5 ? ` / median ${median(base)}` : ""}` : "",
    w.hrvStatus ? `HRV ${w.hrvStatus.toLowerCase()}` : "",
    w.sleepScore != null ? `sleep ${w.sleepScore}` : "",
  ].filter(Boolean).join(" · ");
  if (!reasons.length) {
    return {
      id: "readiness", level: "good", scope: "today",
      title: t("Recovery markers in your normal range", "מדדי ההתאוששות בטווח הרגיל שלך"),
      body: ranToday
        ? t("Good base for recovering from today's run.", "בסיס טוב להתאוששות מהריצה של היום.")
        : t(qualityToday ? "Go ahead with today's session as planned." : "Nothing to change today.", qualityToday ? "אפשר לבצע את האימון של היום כמתוכנן." : "אין מה לשנות היום."),
      evidence, source: "hrMonitoring",
    };
  }
  return {
    id: "readiness", level: "warn", scope: "today",
    title: t(`Recovery looks low: ${reasons.map((r) => r.en).join(", ")}`, `ההתאוששות נראית נמוכה: ${reasons.map((r) => r.he).join(", ")}`),
    body: qualityToday
      ? t("Overnight readings are a secondary signal (wrist sensor). If your legs also feel heavy in the warm-up, make today easy.", "מדידות הלילה הן אות משני (חיישן יד). אם גם הרגליים כבדות בחימום - להפוך את היום לקל.")
      : t("Keep today easy and check again tomorrow.", "לשמור את היום קל ולבדוק שוב מחר."),
    evidence, source: "hrvGuided",
    action: qualityToday ? { href: `/day/${today}?edit=easy`, label: t("Make today easy", "להפוך את היום לקל") } : undefined,
  };
}

export function easyDisciplineInsight(input: InsightInput): Insight | null {
  const from = addDays(input.today, -13);
  const runs = analyzed(input.days.filter((d) => d.date >= from), input.today).filter(({ a }) => a.segments.some((s) => s.role === "easy" && s.verdict !== null));
  if (runs.length < 2) return null;
  const fast = runs.filter(({ a }) => a.segments.some((s) => s.role === "easy" && s.verdict !== null && (s.verdict === "fast" || s.fastShare >= 0.25)));
  const evidence = runs.map(({ day, a }) => `${dm(day.date)} ${fast.some((f) => f.day.date === day.date) ? "↑" : "✓"} ${a.segments.filter((s) => s.role === "easy" && s.pace).map((s) => fmtPace(s.pace as number)).join("/")}`).join(" · ");
  if (fast.length / runs.length >= 0.5) {
    return {
      id: "easy-discipline", level: "warn", scope: "week",
      title: t(`${fast.length} of your last ${runs.length} runs with easy parts ran them faster than planned`, `ב-${fast.length} מתוך ${runs.length} הריצות האחרונות עם חלקים קלים, הקל רץ מהר מהתוכנית`),
      body: t("Keep easy parts at the planned pace or slower, especially warm-ups, cool-downs and the day before a key session. Easy days that run moderate take recovery away from the sessions that matter.", "לשמור על החלקים הקלים בקצב המתוכנן או איטי ממנו - במיוחד חימום, שחרור והיום שלפני אימון מפתח. ימים קלים שנרצים בינוני לוקחים התאוששות מהאימונים החשובים."),
      evidence, source: "intensity",
    };
  }
  if (fast.length === 0 && runs.length >= 3) {
    return {
      id: "easy-discipline", level: "good", scope: "week",
      title: t(`Easy running stayed easy in all ${runs.length} recent runs`, `הריצה הקלה נשארה קלה בכל ${runs.length} הריצות האחרונות`),
      body: t("That's what lets the key sessions land.", "זה מה שמאפשר לאימוני המפתח לעבוד."),
      evidence, source: "intensity",
    };
  }
  return null;
}

export function keySessionsInsight(input: InsightInput): Insight | null {
  const from = addDays(input.today, -20);
  const q = analyzed(input.days.filter((d) => d.date >= from), input.today)
    .flatMap(({ day, a }) => a.segments.filter((s) => s.role === "quality" && s.verdict !== null).map((s) => ({ date: day.date, s })));
  if (q.length < 2) return null;
  const ok = q.filter((x) => x.s.verdict === "ok").length;
  const fast = q.filter((x) => x.s.verdict === "fast").length;
  const evidence = q.map(({ date, s }) => `${dm(date)} ${s.label.en} ${s.pace ? fmtPace(s.pace) : ""} ${s.verdict === "ok" ? "✓" : s.verdict === "fast" ? "↑" : "↓"}`).join(" · ");
  if (fast >= 2) {
    return {
      id: "key-sessions", level: "warn", scope: "week",
      title: t(`${fast} of ${q.length} key parts faster than the target`, `${fast} מתוך ${q.length} קטעי מפתח מהר מהיעד`),
      body: t("Faster than the target adds fatigue without adding the intended stimulus - especially in the taper.", "מהר מהיעד מוסיף עייפות בלי להוסיף את הגירוי המתוכנן - במיוחד בטייפר."),
      evidence, source: "intensity",
    };
  }
  if (ok === q.length) {
    return {
      id: "key-sessions", level: "good", scope: "week",
      title: t(`All ${q.length} key parts on target in the last 3 weeks`, `כל ${q.length} קטעי המפתח ב-3 השבועות האחרונים היו ביעד`),
      body: t("Pacing control is a strong sign for race day.", "שליטה בקצב היא סימן חזק לקראת יום המרוץ."),
      evidence,
    };
  }
  return { id: "key-sessions", level: "info", scope: "week", title: t(`${ok} of ${q.length} key parts on target`, `${ok} מתוך ${q.length} קטעי מפתח ביעד`), body: t("See each day for details.", "פירוט בכל יום."), evidence };
}

export function volumeInsight(input: InsightInput): Insight | null {
  const ws = weekStart(input.today);
  const week = input.days.filter((d) => d.date >= ws && d.date <= addDays(ws, 6));
  const toDate = week.filter((d) => d.date <= input.today);
  const plannedToDate = toDate.reduce((s, d) => s + (d.plan.type === "race" ? 0 : d.plan.km), 0);
  const actual = Math.round(toDate.reduce((s, d) => s + d.actualKm, 0) * 10) / 10;
  const missedRuns = toDate.filter((d) => d.date < input.today && d.plan.type !== "rest" && (d.state === "missed" || d.state === "skipped")).length;
  if (plannedToDate < 5) return null;
  const evidence = `${actual}/${Math.round(plannedToDate * 10) / 10} km · ${toDate.length} days`;
  if (actual < plannedToDate * 0.7 && missedRuns >= 1) {
    return {
      id: "volume", level: "info", scope: "week",
      title: t(`This week: ${actual} of ${Math.round(plannedToDate)} km so far`, `השבוע: ${actual} מתוך ${Math.round(plannedToDate)} ק"מ עד עכשיו`),
      body: t("Don't make up missed kilometres - carry on with the plan. Adding volume late in the week costs more than it gives.", "לא משלימים ק\"מ שהוחמצו - ממשיכים לפי התוכנית. הוספת נפח בסוף השבוע עולה יותר ממה שהיא נותנת."),
      evidence, source: "taper",
    };
  }
  return null;
}

export function loadInsight(input: InsightInput): Insight | null {
  const ws = weekStart(input.today);
  const runs = analyzed(input.days.filter((d) => d.date >= addDays(ws, -7)), input.today).filter(({ a }) => a.srpe != null);
  const thisW = runs.filter(({ day }) => day.date >= ws);
  const lastW = runs.filter(({ day }) => day.date < ws);
  if (thisW.length < 2 || lastW.length < 2) return null;
  const sum = (xs: typeof runs) => xs.reduce((s, x) => s + (x.a.srpe as number), 0);
  const a = sum(thisW), b = sum(lastW);
  const pct = Math.round(((a - b) / b) * 100);
  return {
    id: "load", level: pct > 30 ? "warn" : "info", scope: "week",
    title: t(`Session load (effort × minutes): ${a} this week vs ${b} last week (${pct > 0 ? "+" : ""}${pct}%)`, `עומס אימונים (מאמץ × דקות): ${a} השבוע מול ${b} בשבוע שעבר (${pct > 0 ? "+" : ""}${pct}%)`),
    body: pct > 30
      ? t("A jump of more than ~30% in a week is worth a closer look at sleep and how your legs feel.", "קפיצה של יותר מכ-30% בשבוע שווה בדיקה של שינה ותחושת הרגליים.")
      : t("Within the expected range.", "בטווח הצפוי."),
    evidence: `${thisW.length} + ${lastW.length} rated sessions`, source: "srpe",
  };
}

export function missedPatternInsight(input: InsightInput): Insight | null {
  const from = addDays(input.today, -55);
  const missed = input.days.filter((d) => d.date >= from && d.date < input.today && d.plan.type !== "rest" && (d.state === "missed" || d.state === "skipped") && d.status?.reason !== "ill" && d.status?.reason !== "fever");
  const byDow = new Map<number, string[]>();
  for (const d of missed) byDow.set(weekday(d.date), [...(byDow.get(weekday(d.date)) ?? []), d.date]);
  const top = [...byDow.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!top || top[1].length < 2) return null;
  return {
    id: "missed-pattern", level: "info", scope: "pattern",
    title: t(`${DOW_EN[top[0]]}: ${top[1].length} missed sessions in 8 weeks`, `ימי ${DOW_HE[top[0]]}: ${top[1].length} אימונים שהוחמצו ב-8 שבועות`),
    body: t("If this day is often hard for you, plan the week around it (swap with a nearby rest day in advance).", "אם היום הזה קשה לך לעתים קרובות, כדאי לסדר את השבוע סביבו (להחליף מראש עם יום מנוחה קרוב)."),
    evidence: top[1].map(dm).join(", "),
  };
}

export function raceInsights(input: InsightInput): Insight[] {
  const race = RACES.find((r) => r.date >= input.today);
  if (!race) return [];
  const daysTo = diffDays(race.date, input.today);
  if (daysTo > 28) return [];
  const out: Insight[] = [];
  const pred = predictMarathon(input.acts, input.today);
  if (pred) {
    const lo = pred.seconds * Math.pow(42.195 / pred.km, 1.06);
    const hi = pred.seconds * Math.pow(42.195 / pred.km, 1.08);
    const goal = race.goalTime ? race.goalTime.split(":").reduce((s, x) => s * 60 + Number(x), 0) : null;
    out.push({
      id: "prediction", level: "info", scope: "race",
      // Hebrew uses "between X and Y" so the range never reads reversed in right-to-left text.
      title: t(`Predicted range: ${fmtDuration(lo)}–${fmtDuration(hi)} (${fmtPace(lo / 42.195)}–${fmtPace(hi / 42.195)}/km)`, `טווח צפוי: בין ${fmtDuration(lo)} ל-${fmtDuration(hi)} (קצב בין ${fmtPace(lo / 42.195)} ל-${fmtPace(hi / 42.195)})`),
      body: goal != null
        ? goal < lo
          ? t(`Goal ${race.goalTime} is faster than the prediction: treat it as an A goal for a good day, and let the pacing plan protect the second half.`, `היעד ${race.goalTime} מהיר מהתחזית: זה יעד A ליום טוב, ותוכנית הקצב שומרת על החצי השני.`)
          : t(`Goal ${race.goalTime} is inside the predicted range.`, `היעד ${race.goalTime} בתוך הטווח הצפוי.`)
        : t("Target set after the race before.", "היעד ייקבע בהמשך."),
      evidence: `${pred.label} ${dm(pred.date)}: ${fmtDuration(pred.seconds)} for ${pred.km.toFixed(1)} km; exponent 1.06–1.08; hilly course adds time`,
      source: "riegel",
    });
  }
  // Taper depth: this week's planned km vs the biggest planned week in the last 8 weeks.
  const weeks = new Map<string, number>();
  for (const d of input.days) weeks.set(weekStart(d.date), (weeks.get(weekStart(d.date)) ?? 0) + (d.plan.type === "race" ? 0 : d.plan.km));
  const ws = weekStart(input.today);
  const peak = Math.max(...[...weeks.entries()].filter(([w]) => w < ws).map(([, km]) => km), 0);
  const now = weeks.get(ws) ?? 0;
  if (peak > 0 && daysTo <= 21) {
    const cut = Math.round((1 - now / peak) * 100);
    out.push({
      id: "taper", level: "info", scope: "race",
      title: t(`${daysTo} days to ${race.name.en}: this week ${Math.round(now)} km, ${cut}% below the peak week (${Math.round(peak)} km)`, `${daysTo} ימים ל${race.name.he}: השבוע ${Math.round(now)} ק"מ, ${cut}% מתחת לשבוע השיא (${Math.round(peak)} ק"מ)`),
      body: t("Research on tapering: cut volume ~41–60% over about two weeks, keep intensity and run frequency. Don't add sessions now.", "מחקר על טייפר: הורדת נפח של בין 41% ל-60% בכשבועיים, תוך שמירה על עצימות ועל מספר הריצות. לא מוסיפים אימונים עכשיו."),
      evidence: `planned km per week, last 8 weeks; peak ${Math.round(peak)}`, source: "taper",
    });
  }
  return out;
}

const RANK: Record<InsightLevel, number> = { warn: 0, good: 2, info: 3 };
const SCOPE: Record<Insight["scope"], number> = { today: 0, race: 1, week: 2, pattern: 3 };

/** All insights, most important first: warnings, then today, race, week, patterns. */
export function computeInsights(input: InsightInput): Insight[] {
  const all = [
    readinessInsight(input),
    ...raceInsights(input),
    easyDisciplineInsight(input),
    keySessionsInsight(input),
    volumeInsight(input),
    loadInsight(input),
    missedPatternInsight(input),
  ].filter((x): x is Insight => !!x);
  return all.sort((a, b) => RANK[a.level] - RANK[b.level] || SCOPE[a.scope] - SCOPE[b.scope]);
}
