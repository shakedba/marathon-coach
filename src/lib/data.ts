import * as db from "./db";
import { addDays, weekStart } from "./dates";
import { planWeek } from "./plan";
import { matchWeek } from "./rebalance";

export async function loadWeek(anyDate: string, today: string) {
  const ws = weekStart(anyDate);
  const we = addDays(ws, 6);
  const [overrides, statuses, acts] = await Promise.all([db.overridesBetween(ws, we), db.statusesBetween(ws, we), db.activitiesBetween(ws, we)]);
  const plan = planWeek(ws, overrides);
  return { ws, plan, days: matchWeek(plan, acts, statuses, today), overrides };
}

export const dbConfigured = () => !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
