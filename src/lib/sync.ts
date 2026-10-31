import crypto from "node:crypto";
import { decrypt, encrypt } from "./crypto";
import * as db from "./db";
import { addDays, todayLocal } from "./dates";
import { Garmin, type GarminTokens } from "./garmin/client";
import { mapActivity, mapLaps, mapWellness, toGarminWorkout } from "./garmin/mappers";
import { planFor } from "./plan";
import { mapStrava, Strava, type StravaTokens } from "./strava/client";
import type { Activity } from "./types";

/** Every sync must finish well inside the 60 s function limit. */
const TOTAL_BUDGET_MS = 45_000;
const WELLNESS_RECENT_DAYS = 7;
const WELLNESS_BACKFILL_PER_RUN = 10;
const WELLNESS_HISTORY_DAYS = 730;

class Deadline {
  private end: number;
  constructor(ms: number) { this.end = Date.now() + ms; }
  left() { return this.end - Date.now(); }
  ok(reserveMs = 0) { return this.left() > reserveMs; }
}

export async function garminClient(): Promise<Garmin | null> {
  const blob = await db.kvGet<string>("garmin_tokens");
  return blob ? new Garmin(decrypt<GarminTokens>(blob)) : null;
}
export async function persistGarmin(g: Garmin) {
  if (g.refreshed) {
    await db.kvSet("garmin_tokens", encrypt(g.tokens));
    g.refreshed = false;
  }
}
export async function saveGarminTokens(t: GarminTokens) {
  await db.kvSet("garmin_tokens", encrypt(t));
  await db.kvDel("garmin_history"); // re-scan history for the (possibly different) account
}

interface HistoryState { start: number; done: boolean }

/** Imports Garmin activities. Full history is paged across runs; the newest page is refreshed every run. */
export async function syncGarminActivities(g: Garmin, dl: Deadline) {
  const state = (await db.kvGet<HistoryState>("garmin_history")) ?? { start: 0, done: false };
  let imported = 0;
  const save = async (list: any[]) => {
    for (const a of list) await db.upsertActivity(mapActivity(a));
    imported += list.length;
  };
  await save(await g.activities(0, 30));
  while (!state.done && dl.ok(25_000)) {
    const page = await g.activities(state.start, 100);
    await save(page);
    state.start += page.length;
    if (page.length < 100) state.done = true;
    await db.kvSet("garmin_history", state); // checkpoint after each page
  }
  let laps = 0;
  for (const id of await db.runsMissingLaps(30)) {
    if (!dl.ok(18_000)) break;
    try {
      await db.setLaps(id, mapLaps(await g.splits(id.split(":")[1])));
    } catch {
      await db.setLaps(id, []); // don't retry forever on activities without splits
    }
    laps++;
  }
  return { imported, laps, historyDone: state.done, scanned: state.start };
}

/** Recovery data: last 7 days every run, then backfills 10 older days per run, up to 2 years. */
export async function syncGarminWellness(g: Garmin, dl: Deadline) {
  const today = todayLocal();
  let profile = await db.kvGet<{ displayName: string }>("garmin_profile");
  if (!profile) {
    const p = await g.profile();
    profile = { displayName: p.displayName };
    await db.kvSet("garmin_profile", profile);
  }
  const cursor = (await db.kvGet<{ backTo: string }>("garmin_wellness"))?.backTo ?? addDays(today, -WELLNESS_RECENT_DAYS + 1);
  const floor = addDays(today, -WELLNESS_HISTORY_DAYS);
  const recent = Array.from({ length: WELLNESS_RECENT_DAYS }, (_, i) => addDays(today, -i));
  const older = Array.from({ length: WELLNESS_BACKFILL_PER_RUN }, (_, i) => addDays(cursor, -(i + 1))).filter((d) => d >= floor);
  const bb = await g.bodyBattery(older.length ? older[older.length - 1] : recent[recent.length - 1], today);
  let done = 0;
  let oldest = cursor;
  for (const date of [...recent, ...older]) {
    if (!dl.ok(12_000)) break;
    const [hrv, sleep, readiness, summary] = await Promise.all([
      g.hrv(date), g.sleep(profile.displayName, date), g.readiness(date), g.userSummary(profile.displayName, date),
    ]);
    await db.upsertWellness(mapWellness(date, { hrv, sleep, bb: bb.filter((x: any) => x?.date === date), readiness, summary }));
    if (date < oldest) oldest = date;
    done++;
  }
  await db.kvSet("garmin_wellness", { backTo: oldest });
  return { days: done, backTo: oldest };
}

const hash = (v: unknown) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

/** Push the next 7 days of planned workouts to the Garmin calendar. Create-then-delete so a failure never leaves a day empty. */
export async function pushWorkouts(g: Garmin, days = 7) {
  const today = todayLocal();
  const end = addDays(today, days - 1);
  const [overrides, pushed] = await Promise.all([db.overridesBetween(today, end), db.pushesBetween(today, end)]);
  const out: { date: string; action: string }[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const w = planFor(date, overrides);
    const prev = pushed[date];
    if (w.type === "rest") {
      if (prev) {
        await g.deleteWorkout(prev.workoutId);
        await db.deletePush(date);
        out.push({ date, action: "removed" });
      }
      continue;
    }
    const gw = toGarminWorkout(w);
    const h = hash(gw);
    if (prev?.hash === h) continue;
    const created = await g.createWorkout(gw);
    try {
      await g.scheduleWorkout(created.workoutId, date);
    } catch (e) {
      await g.deleteWorkout(created.workoutId);
      throw e;
    }
    await db.setPush(date, created.workoutId, h);
    if (prev) await g.deleteWorkout(prev.workoutId);
    out.push({ date, action: prev ? "updated" : "created" });
  }
  return out;
}

export async function stravaClient(): Promise<Strava | null> {
  const blob = await db.kvGet<string>("strava_tokens");
  return blob ? new Strava(decrypt<StravaTokens>(blob)) : null;
}

/** Same run recorded by Garmin and Strava: start within 2 min and distance within 3% (min 300 m). */
export function isSameRun(a: Activity, b: Activity) {
  return Math.abs(Date.parse(a.startLocal) - Date.parse(b.startLocal)) < 120_000 && Math.abs(a.distanceM - b.distanceM) < Math.max(300, a.distanceM * 0.03);
}

/** Strava backup: imports activities and marks those already recorded by Garmin as duplicates. */
export async function syncStrava(s: Strava, dl: Deadline) {
  const state = (await db.kvGet<{ page: number; done: boolean }>("strava_history")) ?? { page: 1, done: false };
  let imported = 0;
  const handle = async (list: any[]) => {
    const acts = list.map(mapStrava).filter((a) => a.date);
    if (!acts.length) return;
    const dates = acts.map((a) => a.date).sort();
    const garmin = (await db.activitiesBetween(dates[0], dates[dates.length - 1])).filter((x) => x.source === "garmin");
    for (const act of acts) {
      await db.upsertActivity(act);
      const same = garmin.find((x) => isSameRun(x, act));
      if (same) await db.markDuplicate(act.id, same.id);
    }
    imported += acts.length;
  };
  try {
    await handle(await s.activities(1));
    while (!state.done && dl.ok(5_000)) {
      const list = await s.activities(state.page);
      await handle(list);
      if (list.length < 100) state.done = true;
      state.page++;
      await db.kvSet("strava_history", state);
    }
  } finally {
    if (s.refreshed) await db.kvSet("strava_tokens", encrypt(s.tokens));
  }
  return { imported, historyDone: state.done };
}

export interface SyncResult {
  skipped?: string;
  garmin?: unknown;
  wellness?: unknown;
  pushed?: unknown;
  strava?: unknown;
  errors: string[];
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** One sync at a time (cron, button and login can overlap): guarded by a DB lock. */
export async function syncAll(opts: { push?: boolean } = {}): Promise<SyncResult> {
  if (!(await db.tryLock("sync", 70_000))) return { skipped: "another sync is running", errors: [] };
  const dl = new Deadline(TOTAL_BUDGET_MS);
  const res: SyncResult = { errors: [] };
  try {
    const g = await garminClient();
    if (g) {
      try {
        if (opts.push !== false) {
          try { res.pushed = await pushWorkouts(g); } catch (e) { res.errors.push(`push: ${msg(e)}`); }
        }
        try { res.garmin = await syncGarminActivities(g, dl); } catch (e) { res.errors.push(`garmin: ${msg(e)}`); }
        try { res.wellness = await syncGarminWellness(g, dl); } catch (e) { res.errors.push(`wellness: ${msg(e)}`); }
      } finally {
        await persistGarmin(g);
      }
    }
    const s = await stravaClient();
    if (s && dl.ok(5_000)) {
      try { res.strava = await syncStrava(s, dl); } catch (e) { res.errors.push(`strava: ${msg(e)}`); }
    }
    await db.kvSet("last_sync", { at: new Date().toISOString(), errors: res.errors });
    return res;
  } finally {
    await db.unlock("sync");
  }
}
