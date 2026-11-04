/**
 * The taper as approved on 31 Oct 2026, before the 4 Nov adjustment (Wed sessions moved/dropped).
 * Rule tests use this frozen layout so they test the rules, not the current plan.
 */
import { planFor } from "./plan";
import type { Workout } from "./types";

const at = (w: Workout, date: string): Workout => ({ ...w, date });
const rest = (date: string): Workout => ({ date, type: "rest", km: 0, title: { en: "Rest", he: "מנוחה" }, key: false });

export const ORIG_TAPER: Record<string, Workout> = {
  // W16: Wed MP 12, Thu rest, Fri easy 8
  "2026-11-04": at(planFor("2026-11-10", {}), "2026-11-04"),
  "2026-11-05": rest("2026-11-05"),
  "2026-11-06": at(planFor("2026-11-05", {}), "2026-11-06"),
  // W17: Wed easy 8, Thu rest, Fri fast
  "2026-11-11": at(planFor("2026-11-05", {}), "2026-11-11"),
  "2026-11-12": rest("2026-11-12"),
  "2026-11-13": at(planFor("2026-11-12", {}), "2026-11-13"),
  // W18: Tue rest, Wed easy 6
  "2026-11-17": rest("2026-11-17"),
  "2026-11-18": at(planFor("2026-11-17", {}), "2026-11-18"),
};
