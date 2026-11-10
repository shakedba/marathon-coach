/**
 * Post-run analysis (deterministic, no outside services).
 * Primary signals: pace per planned segment (GPS laps) and effort (RPE). Heart rate from the wrist sensor is only used
 * when it passes a plausibility check, and then only as a sanity check (athlete has no chest strap; artefacts seen).
 */
import { fmtPace } from "./dates";
import type { EvidenceKey } from "./evidence";
import type { Activity, Lap, PaceRange, Step, Text, Workout } from "./types";

const t = (en: string, he: string): Text => ({ en, he });
export const HR_MAX = 187; // athlete-reported
const TOL = 5; // s/km grace either side of a planned range
const MIN_LAP_M = 300;

export type Level = "good" | "info" | "warn";
export interface Finding { level: Level; text: Text; evidence?: string; source?: EvidenceKey }
export interface Segment {
  label: Text;
  role: "easy" | "quality" | "recovery";
  planned?: PaceRange;
  km: number;
  pace: number | null; // s/km, distance-weighted
  lapPaces: number[];
  fastShare: number; // share of distance in laps faster than planned - TOL
  slowShare: number;
  verdict: "ok" | "fast" | "slow" | null; // null = not judged
}
export interface Analysis {
  segments: Segment[];
  findings: Finding[];
  hr: { quality: "ok" | "suspect" | "none"; reasons: string[] };
  minutes: number;
  srpe: number | null;
  headline: Level;
}

const lapPace = (l: Lap) => (l.distanceM > 0 ? l.durationS / (l.distanceM / 1000) : Infinity);
const fp = (s: number) => fmtPace(s);
const range = (r: PaceRange) => `${fp(r[0])}-${fp(r[1])}`;

interface FlatStep { kind: Step["kind"]; distM: number; pace?: PaceRange; group: string }
function flatten(steps: Step[], prefix = ""): FlatStep[] {
  const out: FlatStep[] = [];
  steps.forEach((s, i) => {
    if (s.kind === "repeat") {
      for (let r = 0; r < s.times; r++) out.push(...flatten(s.steps, `rep${i}-`).map((x) => ({ ...x, group: `rep${i}-${x.kind}` })));
      return;
    }
    const mid = s.pace ? (s.pace[0] + s.pace[1]) / 2 : 330;
    out.push({ kind: s.kind, distM: s.distM ?? (s.timeS ? (s.timeS / mid) * 1000 : 0), pace: s.pace, group: `${prefix}${i}` });
  });
  return out;
}

const QUALITY_TYPES = new Set(["mp", "tempo", "fast", "intervals", "long", "race"]);

function labelFor(w: Workout, s: FlatStep): { label: Text; role: Segment["role"] } {
  if (s.kind === "recovery") return { label: t("Recoveries", "התאוששויות"), role: "recovery" };
  if (s.kind === "warmup") return s.distM > 3000 ? { label: t("Easy part", "החלק הקל"), role: "easy" } : { label: t("Warm-up", "חימום"), role: "easy" };
  if (s.kind === "cooldown") return { label: t("Cool-down", "שחרור"), role: "easy" };
  // active
  if (s.group.startsWith("rep")) return { label: t("Reps", "חזרות"), role: "quality" };
  switch (w.type) {
    case "mp": return { label: t("Marathon pace", "קצב מרתון"), role: "quality" };
    case "long": return { label: w.steps && w.steps.length > 1 ? t("Marathon pace", "קצב מרתון") : t("Long run", "ריצה ארוכה"), role: w.steps && w.steps.length > 1 ? "quality" : "easy" };
    case "tempo": return { label: t("Tempo", "טמפו"), role: "quality" };
    case "fast": return { label: t("Fast", "מהיר"), role: "quality" };
    case "medium": return { label: t("Medium", "בינוני"), role: "easy" };
    default: return { label: t("Easy", "קל"), role: QUALITY_TYPES.has(w.type) ? "quality" : "easy" };
  }
}

/** Planned range for each lap (by the step it falls in); undefined where the lap isn't judged on pace. */
export function lapTargets(w: Workout, laps: Lap[]): (PaceRange | undefined)[] {
  if (w.type === "hills" || w.type === "rest" || w.type === "race") return laps.map(() => undefined);
  const steps: FlatStep[] = w.steps?.length ? flatten(w.steps) : [{ kind: "active", distM: w.km * 1000, pace: w.pace, group: "0" }];
  const bounds: number[] = [];
  let acc = 0;
  for (const s of steps) { acc += s.distM; bounds.push(acc); }
  let cum = 0;
  return laps.map((l) => {
    const mid = cum + l.distanceM / 2;
    cum += l.distanceM;
    let i = bounds.findIndex((b) => mid < b);
    if (i < 0) i = steps.length - 1;
    return steps[i].kind === "recovery" ? undefined : steps[i].pace;
  });
}

/** Assign laps to planned steps by the lap's mid-distance, then group (all reps together). */
export function segmentize(w: Workout, laps: Lap[]): Segment[] {
  const steps: FlatStep[] = w.steps?.length ? flatten(w.steps) : [{ kind: "active", distM: w.km * 1000, pace: w.pace, group: "0" }];
  const bounds: number[] = [];
  let acc = 0;
  for (const s of steps) { acc += s.distM; bounds.push(acc); }
  const groups = new Map<string, { step: FlatStep; laps: Lap[] }>();
  let cum = 0;
  for (const l of laps) {
    const mid = cum + l.distanceM / 2;
    cum += l.distanceM;
    let i = bounds.findIndex((b) => mid < b);
    if (i < 0) i = steps.length - 1;
    const st = steps[i];
    const g = groups.get(st.group) ?? { step: st, laps: [] };
    g.laps.push(l);
    groups.set(st.group, g);
  }
  const judged = (role: Segment["role"]) => role !== "recovery" && w.type !== "hills" && w.type !== "rest" && w.type !== "race";
  return [...groups.values()].map(({ step, laps: ls }) => {
    const { label, role } = labelFor(w, step);
    const dist = ls.reduce((s, l) => s + l.distanceM, 0);
    const dur = ls.reduce((s, l) => s + l.durationS, 0);
    const pace = dist > 0 ? dur / (dist / 1000) : null;
    const full = ls.filter((l) => l.distanceM >= MIN_LAP_M);
    const fullDist = full.reduce((s, l) => s + l.distanceM, 0) || 1;
    const p = step.pace;
    const fastShare = p ? full.filter((l) => lapPace(l) < p[0] - TOL).reduce((s, l) => s + l.distanceM, 0) / fullDist : 0;
    const slowShare = p ? full.filter((l) => lapPace(l) > p[1] + TOL).reduce((s, l) => s + l.distanceM, 0) / fullDist : 0;
    const verdict = !p || !judged(role) || pace === null ? null : pace < p[0] - TOL ? "fast" : pace > p[1] + TOL ? "slow" : "ok";
    return { label, role, planned: p, km: Math.round(dist / 100) / 10, pace, lapPaces: full.map(lapPace), fastShare, slowShare, verdict };
  });
}

/**
 * Heart-rate plausibility from laps. Suspect when HR jumps ≥10 bpm between consecutive laps (after the first 2 km)
 * while pace changes <3%, when a lap at easy pace reads ≥93% of max HR, or when a lap is 20+ bpm above the athlete's own
 * usual HR at that pace.
 */
export function hrQuality(laps: Lap[], baseline: Lap[] = [], easyPaceFloor = 320): Analysis["hr"] {
  const withHr = laps.filter((l) => l.avgHr && l.distanceM >= MIN_LAP_M);
  if (withHr.length < 2) return { quality: "none", reasons: [] };
  const reasons: string[] = [];
  // Skip the first two laps: HR ramps up normally at the start of any run.
  for (let i = 2; i < withHr.length; i++) {
    const a = withHr[i - 1], b = withHr[i];
    const dHr = (b.avgHr as number) - (a.avgHr as number);
    const dPace = Math.abs(lapPace(b) - lapPace(a)) / lapPace(a);
    if (Math.abs(dHr) >= 10 && dPace < 0.03) reasons.push(`lap ${laps.indexOf(b) + 1}: HR ${dHr > 0 ? "+" : ""}${Math.round(dHr)} with pace ±${Math.round(dPace * 100)}%`);
  }
  for (const l of withHr) {
    if ((l.avgHr as number) >= 0.93 * HR_MAX && lapPace(l) >= easyPaceFloor) reasons.push(`lap ${laps.indexOf(l) + 1}: HR ${Math.round(l.avgHr as number)} at easy pace ${fp(lapPace(l))}`);
  }
  // Personal baseline: HR 20+ above this athlete's usual HR at the same pace (±10 s/km, ≥5 laps from other runs).
  const base = baseline.filter((l) => l.avgHr && l.distanceM >= MIN_LAP_M);
  for (const l of withHr) {
    const near = base.filter((b) => Math.abs(lapPace(b) - lapPace(l)) <= 10).map((b) => b.avgHr as number).sort((x, y) => x - y);
    if (near.length < 5) continue;
    const med = near[Math.floor(near.length / 2)];
    if ((l.avgHr as number) > med + 20) reasons.push(`lap ${laps.indexOf(l) + 1}: HR ${Math.round(l.avgHr as number)} vs your usual ~${Math.round(med)} at ${fp(lapPace(l))}`);
  }
  return { quality: reasons.length ? "suspect" : "ok", reasons };
}

export function analyzeRun(w: Workout, a: Activity, rpe?: number | null, baseline: Lap[] = []): Analysis {
  const laps = a.laps?.length ? a.laps : [{ distanceM: a.distanceM, durationS: a.movingS, avgHr: a.avgHr ?? null }];
  const segments = segmentize(w, laps);
  const findings: Finding[] = [];
  const minutes = Math.round(a.movingS / 60);

  for (const s of segments) {
    if (!s.planned || s.verdict === null) continue;
    const lapsTxt = s.lapPaces.length ? `${fp(Math.min(...s.lapPaces))}-${fp(Math.max(...s.lapPaces))}` : s.pace ? fp(s.pace) : "";
    const ev = `${s.km} km · ${lapsTxt} · target ${range(s.planned)}`;
    if (s.role === "quality") {
      if (s.verdict === "ok") findings.push({ level: "good", text: t(`${s.label.en} on target (${s.pace ? fp(s.pace) : ""}/km).`, `${s.label.he} בדיוק ביעד (${s.pace ? fp(s.pace) : ""}/ק"מ).`), evidence: ev });
      else if (s.verdict === "fast") findings.push({ level: "warn", text: t(`${s.label.en} faster than planned. Faster than the target adds fatigue without adding the intended stimulus.`, `${s.label.he} מהר מהמתוכנן. מהר מהיעד מוסיף עייפות בלי להוסיף את הגירוי המתוכנן.`), evidence: ev, source: "intensity" });
      else findings.push({ level: "info", text: t(`${s.label.en} slower than planned - fine if effort was right; note how it felt.`, `${s.label.he} איטי מהמתוכנן - בסדר אם המאמץ היה נכון; כדאי לציין איך הרגיש.`), evidence: ev });
    } else if (s.role === "easy" && (s.verdict === "fast" || s.fastShare >= 0.25)) {
      const lastThird = s.lapPaces.slice(Math.floor((s.lapPaces.length * 2) / 3));
      const endFast = lastThird.length > 0 && lastThird.filter((p) => p < (s.planned as PaceRange)[0] - TOL).length >= Math.ceil(lastThird.length * 0.6);
      findings.push({
        level: "warn",
        text: t(
          `${s.label.en}: ${Math.round(s.fastShare * 100)}% of the distance faster than ${fp((s.planned as PaceRange)[0])}${endFast ? ", mostly at the end" : ""}. Easy days that run moderate take recovery away from the key sessions.`,
          `${s.label.he}: ${Math.round(s.fastShare * 100)}% מהמרחק מהר מ-${fp((s.planned as PaceRange)[0])}${endFast ? ", בעיקר בסוף" : ""}. ימים קלים שנרצים בינוני לוקחים התאוששות מהאימונים החשובים.`,
        ),
        evidence: ev,
        source: "intensity",
      });
    }
  }
  if (!findings.some((f) => f.level === "warn") && segments.some((s) => s.role === "easy" && s.verdict === "ok")) {
    findings.push({ level: "good", text: t("Easy running stayed easy.", "הריצה הקלה נשארה קלה."), source: "intensity" });
  }

  const planKm = w.type === "rest" ? 0 : w.km;
  const actKm = a.distanceM / 1000;
  if (planKm > 0 && Math.abs(actKm - planKm) > Math.max(1, planKm * 0.1)) {
    findings.push({ level: "info", text: t(`Distance ${actKm.toFixed(1)} km vs ${planKm} planned.`, `מרחק ${actKm.toFixed(1)} ק"מ מול ${planKm} מתוכננים.`) });
  }
  if (w.type === "rest") findings.push({ level: "info", text: t("Run on a planned rest day.", "ריצה ביום מנוחה מתוכנן.") });

  // The personal-baseline check only makes sense for all-easy runs: after fast running HR legitimately stays higher.
  const hr = hrQuality(laps, segments.some((s) => s.role === "quality") ? [] : baseline);
  if (hr.quality === "suspect") {
    findings.push({ level: "info", text: t("Heart rate looks unreliable on this run (wrist sensor) - not used in this analysis.", "הדופק בריצה הזו נראה לא אמין (חיישן יד) - לא נעשה בו שימוש בניתוח."), evidence: hr.reasons.slice(0, 3).join("; "), source: "wristHr" });
  }

  let srpe: number | null = null;
  if (rpe && rpe >= 1 && rpe <= 10) {
    srpe = rpe * minutes;
    const easyDay = ["easy", "medium", "rest"].includes(w.type);
    if (easyDay && rpe >= 6) findings.push({ level: "warn", text: t(`Effort ${rpe}/10 on an easy day - easy should feel 3-4/10.`, `מאמץ ${rpe}/10 ביום קל - קל אמור להרגיש 3-4/10.`), source: "srpe" });
    if (!easyDay && rpe >= 9) findings.push({ level: "warn", text: t(`Effort ${rpe}/10 - very hard for a training session in the taper.`, `מאמץ ${rpe}/10 - קשה מאוד לאימון בטייפר.`), source: "taper" });
    findings.push({ level: "info", text: t(`Session load (RPE × minutes): ${srpe}.`, `עומס האימון (מאמץ × דקות): ${srpe}.`), source: "srpe" });
  } else {
    findings.push({ level: "info", text: t("Rate the effort (1-10) to complete the analysis.", "דרג את המאמץ (1-10) כדי להשלים את הניתוח."), source: "srpe" });
  }

  const headline: Level = findings.some((f) => f.level === "warn") ? "warn" : findings.some((f) => f.level === "good") ? "good" : "info";
  return { segments, findings, hr, minutes, srpe, headline };
}

/** The day's main run (longest running activity), if any. */
export function mainRun(acts: Activity[]): Activity | undefined {
  return acts.filter((a) => /run/i.test(a.sport) || a.source === "strava").sort((x, y) => y.distanceM - x.distanceM)[0];
}
