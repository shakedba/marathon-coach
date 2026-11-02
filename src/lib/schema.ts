// Postgres schema, applied automatically (idempotent) on first DB use.
export const SCHEMA = `
-- marathon-coach schema (Postgres / Neon). Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id text PRIMARY KEY,                 -- "garmin:123" / "strava:456"
  source text NOT NULL,
  start_local text NOT NULL,           -- local wall-clock ISO, no timezone conversion
  date date NOT NULL,
  sport text NOT NULL,
  name text,
  distance_m double precision NOT NULL DEFAULT 0,
  moving_s integer NOT NULL DEFAULT 0,
  avg_hr double precision,
  max_hr double precision,
  elev_gain double precision,
  is_race boolean NOT NULL DEFAULT false,
  laps jsonb,                          -- per-lap distance/time/HR only (no GPS stored)
  duplicate_of text                    -- strava copy of a garmin activity
);
CREATE INDEX IF NOT EXISTS activities_date ON activities (date);

CREATE TABLE IF NOT EXISTS wellness (
  date date PRIMARY KEY,
  hrv_avg double precision,
  hrv_status text,
  sleep_score double precision,
  body_battery_high double precision,
  readiness double precision,
  resting_hr double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overrides (
  date date PRIMARY KEY,
  workout jsonb NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_status (
  date date PRIMARY KEY,
  status text NOT NULL,                -- done | skipped
  reason text,                         -- time | tired | ill | fever | niggle
  feel integer,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposals (
  id serial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  week_start date NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' -- pending | accepted | rejected
);

CREATE TABLE IF NOT EXISTS locks (
  name text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS garmin_pushes (
  date date PRIMARY KEY,
  workout_id bigint NOT NULL,
  plan_hash text NOT NULL,
  pushed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS extra_status (
  date date NOT NULL,
  kind text NOT NULL,                  -- strength | mobility
  status text NOT NULL,                -- done | skipped
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, kind)
);

CREATE TABLE IF NOT EXISTS garmin_extra_pushes (
  date date NOT NULL,
  kind text NOT NULL,
  workout_id bigint NOT NULL,
  plan_hash text NOT NULL,
  pushed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (date, kind)
);
`;
