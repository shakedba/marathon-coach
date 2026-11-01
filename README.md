# Marathon Coach · מאמן מרתון

Personal coaching app for the Haifa Marathon (20 Nov 2026) and Tel Aviv Marathon (26 Feb 2027).
Hebrew + English, phone-first (installable to the home screen).

## What it does
- **Today**: the day's workout (distance, pace, HR cap, steps), Done / Skipped + reason, low-recovery warning.
- **Week**: plan vs. actual per day; missed, partial and moved sessions.
- **Rebalance**: a skip (no time / tired / ill / fever / niggle) produces a **suggested** change you accept or reject. Rules are in `src/lib/rebalance.ts` and covered by tests.
- **Garmin (unofficial)**: full activity history with laps, recovery data (HRV, sleep, Body Battery, training readiness, resting HR), and the next 7 days of workouts pushed to the Garmin calendar so they appear on the watch.
- **Strava (official API)**: backup source; copies of Garmin runs are de-duplicated.
- **Progress**: weekly volume vs. plan, HR at marathon pace over time, Riegel prediction, recovery table.
- **Races**: countdowns, Haifa race plan, fueling, race-morning schedule, Tel Aviv outline.

## Security and privacy
- Single-user login (password, httpOnly + Secure + SameSite cookie). 5 failed logins lock the login for 15 min.
- Garmin password is used once to log in and is **never stored**. Garmin and Strava tokens are stored **encrypted** (AES-256-GCM, key from `ENCRYPTION_KEY`).
- Only run summaries (distance, time, HR, laps) and daily recovery numbers are stored. **No GPS tracks, no raw payloads.**
- Strava OAuth uses a `state` check. Server actions validate their inputs. Strict security headers (CSP, frame-ancestors none, HSTS, noindex).
- Settings → "Delete all data" wipes every table.
- Sync is guarded by a DB lock (cron / button / login can't double-push workouts) and finishes within the 60 s function limit; history imports resume where they stopped.

## Unofficial Garmin access: know the trade-off
Garmin has no public API for personal apps. This uses the same login flow as the open-source `garth` library.
It can break when Garmin changes things, and it's against Garmin's terms of use. If Garmin's login blocks the server, runs keep arriving through Strava. To revoke access at any time, change your Garmin password.

## Deploy (Vercel + Neon)
1. Import this repo in Vercel.
2. Storage → create a **Neon Postgres** database and connect it to the project (sets `DATABASE_URL`).
3. Add env vars from `.env.example` (`APP_PASSWORD`, `ENCRYPTION_KEY`, `CRON_SECRET`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`).
4. Strava app (https://www.strava.com/settings/api): set **Authorization Callback Domain** to your Vercel domain.
5. Deploy, log in, Settings → connect Garmin (code from email/app if 2-step is on), then connect Strava.
6. Tap "Sync now" a few times to finish the full-history import (or let the daily cron do it at 03:45 Israel time).

The schema is created automatically on first use.

## Develop
```bash
npm install
npm run typecheck && npm test
# integration tests (LOCAL Postgres only; they wipe the test DB):
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/mc_test npm test
```
