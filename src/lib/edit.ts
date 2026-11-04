/** Manual workout edits (move / easier / shorter / rest / add). Pure: returns the new workouts, the caller saves them. */
import { weekStart } from "./dates";
import { checkEdit, easyVersion, rest, scaleWorkout, type EditCheck } from "./rebalance";
import type { Text, Workout } from "./types";

export type EditOp = { kind: "easy" } | { kind: "short" } | { kind: "rest" } | { kind: "add"; km: number } | { kind: "move"; to: string };

const t = (en: string, he: string): Text => ({ en, he });
const BY_YOU = t("Changed by you", "שונה על ידך");

export function parseOp(s: string | undefined | null): EditOp | null {
  if (!s) return null;
  if (s === "easy" || s === "short" || s === "rest") return { kind: s };
  const add = /^add-(\d{1,2})$/.exec(s);
  if (add) {
    const km = Number(add[1]);
    return km >= 4 && km <= 12 ? { kind: "add", km } : null;
  }
  const mv = /^move-(\d{4}-\d{2}-\d{2})$/.exec(s);
  return mv ? { kind: "move", to: mv[1] } : null;
}
export const opKey = (op: EditOp) => (op.kind === "add" ? `add-${op.km}` : op.kind === "move" ? `move-${op.to}` : op.kind);

export interface EditResult extends EditCheck {
  /** New workouts to store as overrides, with the reason to store. */
  writes: { w: Workout; reason: string }[];
  after: Workout[];
}

/** Which ops make sense for a planned workout (UI menu). */
export function availableOps(w: Workout): EditOp["kind"][] {
  if (w.type === "race") return [];
  if (w.type === "rest") return ["add", "move"];
  const ops: EditOp["kind"][] = [];
  if (w.type !== "easy") ops.push("easy");
  if (w.km >= 6) ops.push("short");
  ops.push("rest", "move");
  return ops;
}

export function applyEdit(week: Workout[], date: string, op: EditOp, today: string): EditResult {
  const i = week.findIndex((w) => w.date === date);
  const bad = (en: string, he: string): EditResult => ({ block: t(en, he), warnings: [], writes: [], after: week });
  if (i < 0) return bad("Day not in this week.", "היום לא בשבוע הזה.");
  const w = week[i];
  if (!availableOps(w).includes(op.kind)) return bad("That change isn't possible for this day.", "השינוי הזה לא אפשרי ליום הזה.");
  const after = [...week];
  const writes: EditResult["writes"] = [];
  const put = (nw: Workout, reason: string) => {
    after[after.findIndex((x) => x.date === nw.date)] = nw;
    writes.push({ w: nw, reason });
  };
  let changed = [date];
  switch (op.kind) {
    case "easy": {
      put(easyVersion(w, Math.min(1, 10 / w.km), BY_YOU), "edit:easy");
      break;
    }
    case "short": {
      put({ ...scaleWorkout(w, 0.75), notes: BY_YOU }, "edit:short");
      break;
    }
    case "rest": {
      put(rest(date, BY_YOU), "edit:rest");
      break;
    }
    case "add": {
      const e = easyVersion({ ...w, km: op.km }, 1, BY_YOU);
      put(e, "edit:add");
      break;
    }
    case "move": {
      if (op.to === date || weekStart(op.to) !== weekStart(date)) return bad("Moves stay inside the same week (Mon-Sun).", "הזזה רק בתוך אותו שבוע (ב'-א').");
      const other = week.find((x) => x.date === op.to)!;
      if (other.type === "race") return bad("Race day can't be changed.", "אי אפשר לשנות את יום המרוץ.");
      const movedIn = w.type === "rest" ? rest(op.to) : { ...w, date: op.to, notes: t(`Moved from ${date} by you`, `הוזז מ-${date} על ידך`) };
      const movedOut = other.type === "rest" ? rest(date) : { ...other, date, notes: t(`Moved from ${op.to} by you`, `הוזז מ-${op.to} על ידך`) };
      put(movedIn, `swap:${date}`);
      put(movedOut, `swap:${op.to}`);
      changed = [date, op.to];
      break;
    }
  }
  return { ...checkEdit(week, after, changed, today), writes, after };
}

/** Days a workout can move to: same week, today or later, not the day itself, not race day. */
export function moveTargets(week: Workout[], date: string, today: string): string[] {
  return week.filter((x) => x.date !== date && x.date >= today && x.type !== "race").map((x) => x.date);
}

