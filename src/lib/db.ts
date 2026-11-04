import postgres from "postgres";
import { SCHEMA } from "./schema";
import type { Activity, DayStatus, Proposal, Wellness, Workout } from "./types";

type Row = Record<string, any>;
let _sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

function sqlFn() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (!_sql) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    _sql = postgres(url, {
      max: 1, // one connection per serverless instance; use the provider's pooled URL
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // required by transaction-mode poolers (Neon/Supabase pgbouncer)
      ssl: local ? false : "require",
      onnotice: () => {},
      // Keep DATE columns as plain YYYY-MM-DD strings (no timezone conversion).
      types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
    });
  }
  return _sql;
}

/** Applies the schema once per cold start (idempotent). */
async function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean)) {
        await sqlFn().unsafe(stmt);
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  await ensureSchema();
  return (await sqlFn().unsafe(text, params as any[])) as unknown as Row[];
}

/** `date` columns come back as Date at local midnight: read local components to avoid timezone drift. */
const d = (v: any): string =>
  v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
    : String(v).slice(0, 10);

// ---------- kv ----------
export async function kvGet<T>(key: string): Promise<T | null> {
  const r = await q("SELECT value FROM kv WHERE key=$1", [key]);
  return (r[0]?.value as T) ?? null;
}
export async function kvSet(key: string, value: unknown) {
  await q("INSERT INTO kv(key,value,updated_at) VALUES($1,$2::text::jsonb,now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()", [key, JSON.stringify(value)]);
}
export async function kvDel(key: string) {
  await q("DELETE FROM kv WHERE key=$1", [key]);
}

// ---------- activities ----------
/** Only summary fields are stored - never GPS tracks or raw payloads. */
export async function upsertActivity(a: Activity) {
  await q(
    `INSERT INTO activities(id,source,start_local,date,sport,name,distance_m,moving_s,avg_hr,max_hr,elev_gain,is_race,laps,training_load,aerobic_te,anaerobic_te)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text::jsonb,$14,$15,$16)
     ON CONFLICT(id) DO UPDATE SET start_local=$3, date=$4, sport=$5, name=$6, distance_m=$7, moving_s=$8, avg_hr=$9, max_hr=$10,
       elev_gain=$11, is_race=$12, laps=COALESCE(EXCLUDED.laps, activities.laps),
       training_load=COALESCE(EXCLUDED.training_load, activities.training_load),
       aerobic_te=COALESCE(EXCLUDED.aerobic_te, activities.aerobic_te),
       anaerobic_te=COALESCE(EXCLUDED.anaerobic_te, activities.anaerobic_te)`,
    [a.id, a.source, a.startLocal, a.date, a.sport, a.name, a.distanceM, a.movingS, a.avgHr ?? null, a.maxHr ?? null, a.elevGain ?? null, !!a.isRace,
     a.laps ? JSON.stringify(a.laps) : null, a.trainingLoad ?? null, a.aerobicTE ?? null, a.anaerobicTE ?? null],
  );
}
export async function setLaps(id: string, laps: unknown) {
  await q("UPDATE activities SET laps=$2::text::jsonb WHERE id=$1", [id, JSON.stringify(laps)]);
}
export async function markDuplicate(id: string, of: string) {
  await q("UPDATE activities SET duplicate_of=$2 WHERE id=$1", [id, of]);
}
const toActivity = (r: Row): Activity => ({
  id: r.id, source: r.source, startLocal: String(r.start_local), date: d(r.date), sport: r.sport, name: r.name ?? "",
  distanceM: r.distance_m, movingS: r.moving_s, avgHr: r.avg_hr, maxHr: r.max_hr, elevGain: r.elev_gain, isRace: r.is_race, laps: r.laps,
  trainingLoad: r.training_load ?? null, aerobicTE: r.aerobic_te ?? null, anaerobicTE: r.anaerobic_te ?? null,
});
/** Activities in a date range, excluding Strava duplicates of Garmin runs. */
export async function activitiesBetween(from: string, to: string): Promise<Activity[]> {
  const r = await q("SELECT * FROM activities WHERE date BETWEEN $1 AND $2 AND duplicate_of IS NULL ORDER BY start_local", [from, to]);
  return r.map(toActivity);
}
export async function runsMissingLaps(limit: number) {
  const r = await q("SELECT id FROM activities WHERE source='garmin' AND laps IS NULL AND sport ILIKE '%run%' ORDER BY start_local DESC LIMIT $1", [limit]);
  return r.map((x) => String(x.id));
}
export async function activityCount() {
  const r = await q("SELECT source, count(*)::int AS n, min(date) AS first FROM activities GROUP BY source");
  return r.map((x) => ({ source: x.source as string, n: x.n as number, first: x.first ? d(x.first) : null }));
}

// ---------- wellness ----------
export async function upsertWellness(w: Wellness) {
  await q(
    `INSERT INTO wellness(date,hrv_avg,hrv_status,sleep_score,body_battery_high,readiness,resting_hr,acute_load,chronic_load,load_ratio,training_status,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     ON CONFLICT(date) DO UPDATE SET hrv_avg=$2,hrv_status=$3,sleep_score=$4,body_battery_high=$5,readiness=$6,resting_hr=$7,
       acute_load=COALESCE($8, wellness.acute_load), chronic_load=COALESCE($9, wellness.chronic_load),
       load_ratio=COALESCE($10, wellness.load_ratio), training_status=COALESCE($11, wellness.training_status), updated_at=now()`,
    [w.date, w.hrvAvg ?? null, w.hrvStatus ?? null, w.sleepScore ?? null, w.bodyBatteryHigh ?? null, w.readiness ?? null, w.restingHr ?? null,
     w.acuteLoad ?? null, w.chronicLoad ?? null, w.loadRatio ?? null, w.trainingStatus ?? null],
  );
}
export async function wellnessBetween(from: string, to: string): Promise<Wellness[]> {
  const r = await q("SELECT * FROM wellness WHERE date BETWEEN $1 AND $2 ORDER BY date", [from, to]);
  return r.map((x) => ({ date: d(x.date), hrvAvg: x.hrv_avg, hrvStatus: x.hrv_status, sleepScore: x.sleep_score, bodyBatteryHigh: x.body_battery_high, readiness: x.readiness, restingHr: x.resting_hr,
    acuteLoad: x.acute_load ?? null, chronicLoad: x.chronic_load ?? null, loadRatio: x.load_ratio ?? null, trainingStatus: x.training_status ?? null }));
}

// ---------- plan state ----------
export async function overridesBetween(from: string, to: string): Promise<Record<string, Workout>> {
  const r = await q("SELECT date, workout FROM overrides WHERE date BETWEEN $1 AND $2", [from, to]);
  return Object.fromEntries(r.map((x) => [d(x.date), x.workout as Workout]));
}
export async function setOverride(w: Workout, reason: string) {
  await q("INSERT INTO overrides(date,workout,reason) VALUES($1,$2::text::jsonb,$3) ON CONFLICT(date) DO UPDATE SET workout=EXCLUDED.workout, reason=EXCLUDED.reason, created_at=now()", [w.date, JSON.stringify(w), reason]);
}
export async function getOverride(date: string): Promise<{ workout: Workout; reason: string } | null> {
  const r = await q("SELECT workout, reason FROM overrides WHERE date = $1", [date]);
  return r[0] ? { workout: r[0].workout as Workout, reason: r[0].reason ?? "" } : null;
}
export async function deleteOverride(date: string) {
  await q("DELETE FROM overrides WHERE date = $1", [date]);
}
export async function statusesBetween(from: string, to: string): Promise<Record<string, DayStatus>> {
  const r = await q("SELECT * FROM day_status WHERE date BETWEEN $1 AND $2", [from, to]);
  return Object.fromEntries(r.map((x) => [d(x.date), { date: d(x.date), status: x.status, reason: x.reason ?? undefined, feel: x.feel ?? undefined, note: x.note ?? undefined }]));
}
export async function setStatus(s: DayStatus) {
  await q(
    "INSERT INTO day_status(date,status,reason,feel,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(date) DO UPDATE SET status=$2, reason=$3, feel=$4, note=$5, updated_at=now()",
    [s.date, s.status, s.reason ?? null, s.feel ?? null, s.note ?? null],
  );
}
export async function addProposal(p: Proposal): Promise<number> {
  await q("UPDATE proposals SET status='rejected' WHERE week_start=$1 AND status='pending'", [p.weekStart]);
  const r = await q("INSERT INTO proposals(week_start,payload) VALUES($1,$2::text::jsonb) RETURNING id", [p.weekStart, JSON.stringify(p)]);
  return r[0].id;
}
export async function pendingProposals(): Promise<{ id: number; proposal: Proposal }[]> {
  const r = await q("SELECT id, payload FROM proposals WHERE status='pending' ORDER BY created_at DESC");
  return r.map((x) => ({ id: x.id, proposal: x.payload as Proposal }));
}
export async function getProposal(id: number): Promise<{ proposal: Proposal; status: string } | null> {
  const r = await q("SELECT payload, status FROM proposals WHERE id=$1", [id]);
  return r[0] ? { proposal: r[0].payload, status: r[0].status } : null;
}
export async function setProposalStatus(id: number, status: "accepted" | "rejected") {
  await q("UPDATE proposals SET status=$2 WHERE id=$1", [id, status]);
}

// ---------- garmin pushes ----------
export async function pushesBetween(from: string, to: string): Promise<Record<string, { workoutId: number; hash: string }>> {
  const r = await q("SELECT * FROM garmin_pushes WHERE date BETWEEN $1 AND $2", [from, to]);
  return Object.fromEntries(r.map((x) => [d(x.date), { workoutId: Number(x.workout_id), hash: x.plan_hash }]));
}
export async function setPush(date: string, workoutId: number, hash: string) {
  await q("INSERT INTO garmin_pushes(date,workout_id,plan_hash) VALUES($1,$2,$3) ON CONFLICT(date) DO UPDATE SET workout_id=$2, plan_hash=$3, pushed_at=now()", [date, workoutId, hash]);
}
export async function deletePush(date: string) {
  await q("DELETE FROM garmin_pushes WHERE date=$1", [date]);
}

// ---------- strength / mobility ----------
export async function extraStatusesBetween(from: string, to: string): Promise<Record<string, "done" | "skipped">> {
  const r = await q("SELECT date, kind, status FROM extra_status WHERE date BETWEEN $1 AND $2", [from, to]);
  return Object.fromEntries(r.map((x) => [`${d(x.date)}:${x.kind}`, x.status]));
}
export async function setExtraStatus(date: string, kind: string, status: "done" | "skipped" | null) {
  if (status === null) await q("DELETE FROM extra_status WHERE date=$1 AND kind=$2", [date, kind]);
  else await q("INSERT INTO extra_status(date,kind,status) VALUES($1,$2,$3) ON CONFLICT(date,kind) DO UPDATE SET status=EXCLUDED.status, updated_at=now()", [date, kind, status]);
}
export async function recentSkips(from: string, to: string): Promise<{ date: string; reason?: string }[]> {
  const r = await q("SELECT date, reason FROM day_status WHERE status='skipped' AND date BETWEEN $1 AND $2", [from, to]);
  return r.map((x) => ({ date: d(x.date), reason: x.reason ?? undefined }));
}
export async function extraPushesBetween(from: string, to: string): Promise<Record<string, { workoutId: number; hash: string }>> {
  const r = await q("SELECT * FROM garmin_extra_pushes WHERE date BETWEEN $1 AND $2", [from, to]);
  return Object.fromEntries(r.map((x) => [`${d(x.date)}:${x.kind}`, { workoutId: Number(x.workout_id), hash: x.plan_hash }]));
}
export async function setExtraPush(date: string, kind: string, workoutId: number, hash: string) {
  await q("INSERT INTO garmin_extra_pushes(date,kind,workout_id,plan_hash) VALUES($1,$2,$3,$4) ON CONFLICT(date,kind) DO UPDATE SET workout_id=EXCLUDED.workout_id, plan_hash=EXCLUDED.plan_hash, pushed_at=now()", [date, kind, workoutId, hash]);
}
export async function deleteExtraPush(date: string, kind: string) {
  await q("DELETE FROM garmin_extra_pushes WHERE date=$1 AND kind=$2", [date, kind]);
}

// ---------- locks ----------
/** Atomic lease: succeeds if the lock is free or expired. */
export async function tryLock(name: string, ttlMs: number): Promise<boolean> {
  const r = await q(
    `INSERT INTO locks(name, expires_at) VALUES($1, now() + ($2 || ' milliseconds')::interval)
     ON CONFLICT(name) DO UPDATE SET expires_at = EXCLUDED.expires_at WHERE locks.expires_at < now()
     RETURNING name`,
    [name, String(ttlMs)],
  );
  return r.length > 0;
}
export async function unlock(name: string) {
  await q("DELETE FROM locks WHERE name=$1", [name]);
}

// ---------- login throttling ----------
/** Returns true if login attempts are currently blocked (5 failures -> 15 min lockout). */
export async function loginBlocked(): Promise<boolean> {
  const s = await kvGet<{ fails: number; until?: number }>("login_fails");
  return !!s?.until && s.until > Date.now();
}
export async function recordLogin(ok: boolean) {
  if (ok) return kvDel("login_fails");
  const s = (await kvGet<{ fails: number; until?: number }>("login_fails")) ?? { fails: 0 };
  const fails = (s.until && s.until < Date.now() ? 0 : s.fails) + 1;
  await kvSet("login_fails", { fails, until: fails >= 5 ? Date.now() + 15 * 60_000 : undefined });
}

// ---------- privacy ----------
/** Deletes every stored record (tokens, activities, health data, plan changes). */
export async function deleteAllData() {
  for (const t of ["activities", "wellness", "overrides", "day_status", "proposals", "garmin_pushes", "extra_status", "garmin_extra_pushes", "locks", "kv"]) {
    await q(`DELETE FROM ${t}`);
  }
}
