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
  async activities(page: number, after?: number): Promise<any[]> {
    const p = new URLSearchParams({ page: String(page), per_page: "100" });
    if (after) p.set("after", String(after));
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?${p}`, { headers: { Authorization: await this.bearer() } });
    if (!r.ok) throw new Error(`Strava activities ${r.status}`);
    return r.json();
  }
}

const SPORTS: Record<string, string> = { Run: "running", TrailRun: "trail_running", VirtualRun: "treadmill_running", Walk: "walking", Swim: "swimming", Ride: "cycling" };
const stravaSport = (t?: string) => (t ? SPORTS[t] ?? t.toLowerCase() : "unknown");

export function mapStrava(a: any): Activity {
  const startLocal = String(a.start_date_local ?? "").replace("Z", "").slice(0, 19);
  return {
    id: `strava:${a.id}`,
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
