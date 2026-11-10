import * as db from "./db";
import { addDays, weekStart } from "./dates";
import { computeInsights, type Insight } from "./insights";
import { planWeek } from "./plan";
import { matchWeek, type DayMatch } from "./rebalance";

/** Loads ~8 weeks of plan/activities/statuses + 21 days of wellness in 4 queries and computes the insights. */
export async function loadInsights(today: string): Promise<Insight[]> {
  const from = addDays(weekStart(today), -7 * 8);
  const to = addDays(weekStart(today), 6);
  const [acts, overrides, statuses, wellness] = await Promise.all([
    db.activitiesBetween(from, today),
    db.overridesBetween(from, to),
    db.statusesBetween(from, to),
    db.wellnessBetween(addDays(today, -21), today),
  ]);
  const days: DayMatch[] = [];
  for (let ws = from; ws <= weekStart(today); ws = addDays(ws, 7)) {
    const we = addDays(ws, 6);
    days.push(...matchWeek(planWeek(ws, overrides), acts.filter((a) => a.date >= ws && a.date <= we), statuses, today));
  }
  return computeInsights({ today, days, acts, wellness });
}
