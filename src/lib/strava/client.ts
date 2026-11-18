import type { Activity } from "../types";

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

const env = () => {
  // Trim: values pasted into the dashboard often carry a trailing newline/space.
  const id = process.env.STRAVA_CLIENT_ID?.trim();
  const secret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET not configured");
  return { id, secret };
};

/** Client ID in use (not secret: it appears in every Strava authorize link). */
export const stravaClientId = () => process.env.STRAVA_CLIENT_ID?.trim() || null;

export function authorizeUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({ client_id: env().id, redirect_uri: redirectUri, response_type: "code", approval_prompt: "auto", scope: "activity:read_all", state });
  return `https://www.strava.com/oauth/authorize?${p}`;
}

async function token(body: Record<string, string>): Promise<StravaTokens> {
  const { id, secret } = env();
  const r = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }).toString(),
  });
  if (!r.ok) throw new Error(`Strava token error ${r.status}`);
  const j = await r.json();
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at };
}

export const exchangeCode = (code: string) => token({ code, grant_type: "authorization_code" });

export class Strava {
  refreshed = false;
  constructor(public tokens: StravaTokens) {}
  private async bearer() {
    if (this.tokens.expires_at < Date.now() / 1000 + 60) {
      this.tokens = await token({ refresh_token: this.tokens.refresh_token, grant_type: "refresh_token" });
      this.refreshed = true;
    }
    return `Bearer ${this.tokens.access_token}`;
  }
  async activities(page: number, after?: number): Promise<StravaActivity[]> {
    const p = new URLSearchParams({ page: String(page), per_page: "100" });
    if (after) p.set("after", String(after));
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?${p}`, { headers: { Authorization: await this.bearer() } });
    if (!r.ok) throw new Error(`Strava activities ${r.status}`);
    return parseStravaJson(await r.text());
  }
}

/** Raw Strava activity (only the fields we read). `id` is 64-bit: keep it a string, never a lossy JS number. */
export interface StravaActivity { id: string | number; [k: string]: any }

/**
 * JSON.parse that keeps `id` values as their exact source text. Strava IDs are moving to 64-bit and a JS number
 * is only exact up to 2^53. The reviver's 3rd argument (`context.source`) needs Node 21+; typed via rest args because
 * TS lib types don't declare it. Where it is missing the number is kept and `stravaId()` rejects it if unsafe.
 */
export function parseStravaJson(text: string): any {
  return JSON.parse(text, (k: string, v: unknown, ...rest: unknown[]) => {
    const ctx = rest[0] as { source?: string } | undefined;
    return k === "id" && typeof v === "number" ? (ctx?.source ?? v) : v;
  });
}

/** Exact ID string, or null when it can't be trusted (a number above 2^53 has already lost precision). */
export function stravaId(id: unknown): string | null {
  if (typeof id === "string") return /^\d+$/.test(id) ? id : null;
  return typeof id === "number" && Number.isSafeInteger(id) && id >= 0 ? String(id) : null;
}

const SPORTS: Record<string, string> = { Run: "running", TrailRun: "trail_running", VirtualRun: "treadmill_running", Walk: "walking", Swim: "swimming", Ride: "cycling" };
const stravaSport = (t?: string) => (t ? SPORTS[t] ?? t.toLowerCase() : "unknown");

/** Returns null for an activity whose ID can't be trusted, so one bad record never aborts the page. */
export function mapStrava(a: StravaActivity): Activity | null {
  const sid = stravaId(a.id);
  if (!sid) return null;
  const startLocal = String(a.start_date_local ?? "").replace("Z", "").slice(0, 19);
  return {
    id: `strava:${sid}`,
    source: "strava",
    startLocal,
    date: startLocal.slice(0, 10),
    sport: stravaSport(a.sport_type ?? a.type),
    name: a.name ?? "",
    distanceM: Number(a.distance ?? 0),
    movingS: Number(a.moving_time ?? 0),
    avgHr: a.average_heartrate ?? null,
    maxHr: a.max_heartrate ?? null,
    elevGain: a.total_elevation_gain ?? null,
    isRace: a.workout_type === 1,
  };
}
