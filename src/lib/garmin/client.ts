/**
 * Unofficial Garmin Connect client (TypeScript port of the auth flow used by the
 * open-source `garth` library). Not endorsed by Garmin; endpoints may change.
 *
 * Flow: SSO login (+ optional MFA) -> service ticket -> OAuth1 token (long-lived, ~1y)
 *       -> OAuth2 bearer (short-lived, refreshed by re-exchanging OAuth1).
 */
import crypto from "node:crypto";

const DOMAIN = "garmin.com";
const CLIENT_ID = "GCM_ANDROID_DARK";
const SERVICE_URL = `https://mobile.integration.${DOMAIN}/gcm/android`;
const CONSUMER_URL = "https://thegarth.s3.amazonaws.com/oauth_consumer.json";
const OAUTH_UA = "com.garmin.android.apps.connectmobile";
const API_UA = "GCM-iOS-5.22.1.4";
const SSO_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SSO_HEADERS: Record<string, string> = {
  "User-Agent": SSO_UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
};

export interface OAuth1Token {
  oauth_token: string;
  oauth_token_secret: string;
  mfa_token?: string;
}
export interface OAuth2Token {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  refresh_token_expires_at: number;
  [k: string]: unknown;
}
export interface GarminTokens {
  oauth1: OAuth1Token;
  oauth2: OAuth2Token;
}
export interface MfaState {
  cookies: Record<string, string>;
  mfaMethod: string;
}

export class GarminError extends Error {
  constructor(msg: string, public status?: number) {
    super(msg);
  }
}

// ---------------- cookies ----------------
class Jar {
  constructor(public cookies: Record<string, string> = {}) {}
  absorb(res: Response) {
    const list = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    for (const c of list) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    }
  }
  header() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function ssoFetch(jar: Jar, url: string, init: RequestInit = {}, hops = 5): Promise<Response> {
  const headers = new Headers(init.headers);
  if (Object.keys(jar.cookies).length) headers.set("Cookie", jar.header());
  const res = await fetch(url, { ...init, headers, redirect: "manual" });
  jar.absorb(res);
  const loc = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && loc && hops > 0) {
    return ssoFetch(jar, new URL(loc, url).toString(), { headers: init.headers, method: "GET" }, hops - 1);
  }
  return res;
}

// ---------------- OAuth1 ----------------
let consumer: { consumer_key: string; consumer_secret: string } | null = null;
async function getConsumer() {
  if (!consumer && process.env.GARMIN_CONSUMER_KEY && process.env.GARMIN_CONSUMER_SECRET) {
    consumer = { consumer_key: process.env.GARMIN_CONSUMER_KEY, consumer_secret: process.env.GARMIN_CONSUMER_SECRET };
  }
  if (!consumer) {
    const r = await fetch(CONSUMER_URL);
    if (!r.ok) throw new GarminError("Could not load Garmin OAuth consumer");
    consumer = await r.json();
  }
  return consumer!;
}

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export function oauth1Header(
  method: string,
  url: string,
  ck: { consumer_key: string; consumer_secret: string },
  token?: { key: string; secret: string },
  body: Record<string, string> = {},
  nonce = crypto.randomBytes(16).toString("hex"),
  timestamp = Math.floor(Date.now() / 1000).toString(),
): string {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: ck.consumer_key,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
  };
  if (token) oauth.oauth_token = token.key;
  const params: [string, string][] = [];
  u.searchParams.forEach((v, k) => params.push([k, v]));
  for (const [k, v] of Object.entries(body)) params.push([k, v]);
  for (const [k, v] of Object.entries(oauth)) params.push([k, v]);
  const norm = params
    .map(([k, v]) => [enc(k), enc(v)])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const base = [method.toUpperCase(), enc(baseUrl), enc(norm)].join("&");
  const key = `${enc(ck.consumer_secret)}&${enc(token?.secret ?? "")}`;
  const sig = crypto.createHmac("sha1", key).update(base).digest("base64");
  const all = { ...oauth, oauth_signature: sig };
  return "OAuth " + Object.entries(all).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(", ");
}

async function getOAuth1(ticket: string): Promise<OAuth1Token> {
  const ck = await getConsumer();
  const url = `https://connectapi.${DOMAIN}/oauth-service/oauth/preauthorized?ticket=${encodeURIComponent(ticket)}&login-url=${encodeURIComponent(SERVICE_URL)}&accepts-mfa-tokens=true`;
  const r = await fetch(url, { headers: { "User-Agent": OAUTH_UA, Authorization: oauth1Header("GET", url, ck) } });
  if (!r.ok) throw new GarminError(`OAuth1 preauthorized failed (${r.status})`, r.status);
  const q = new URLSearchParams(await r.text());
  return { oauth_token: q.get("oauth_token")!, oauth_token_secret: q.get("oauth_token_secret")!, mfa_token: q.get("mfa_token") ?? undefined };
}

export async function exchange(oauth1: OAuth1Token, login = false): Promise<OAuth2Token> {
  const ck = await getConsumer();
  const url = `https://connectapi.${DOMAIN}/oauth-service/oauth/exchange/user/2.0`;
  const body: Record<string, string> = {};
  if (login) body.audience = "GARMIN_CONNECT_MOBILE_ANDROID_DI";
  if (oauth1.mfa_token) body.mfa_token = oauth1.mfa_token;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": OAUTH_UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: oauth1Header("POST", url, ck, { key: oauth1.oauth_token, secret: oauth1.oauth_token_secret }, body),
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!r.ok) throw new GarminError(`OAuth2 exchange failed (${r.status})`, r.status);
  const tok = await r.json();
  const now = Math.floor(Date.now() / 1000);
  return { ...tok, expires_at: now + tok.expires_in, refresh_token_expires_at: now + tok.refresh_token_expires_in };
}

// ---------------- SSO login ----------------
const loginParams = () => new URLSearchParams({ clientId: CLIENT_ID, locale: "en-US", service: SERVICE_URL }).toString();

async function complete(jar: Jar, ticket: string): Promise<GarminTokens> {
  try {
    await ssoFetch(jar, `https://sso.${DOMAIN}/portal/sso/embed`, { headers: { ...SSO_HEADERS, "Sec-Fetch-Site": "same-origin" } });
  } catch {
    /* best effort */
  }
  const oauth1 = await getOAuth1(ticket);
  const oauth2 = await exchange(oauth1, true);
  return { oauth1, oauth2 };
}

async function ssoJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new GarminError(`Garmin SSO returned a non-JSON response (${res.status}). It may be blocking this server.`, res.status);
  }
}

export async function login(email: string, password: string): Promise<{ status: "ok"; tokens: GarminTokens } | { status: "mfa"; state: MfaState }> {
  const jar = new Jar();
  await ssoFetch(jar, `https://sso.${DOMAIN}/mobile/sso/en/sign-in?clientId=${CLIENT_ID}`, { headers: { ...SSO_HEADERS, "Sec-Fetch-Site": "none" } });
  const res = await ssoFetch(jar, `https://sso.${DOMAIN}/mobile/api/login?${loginParams()}`, {
    method: "POST",
    headers: { ...SSO_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password, rememberMe: false, captchaToken: "" }),
  });
  const j = await ssoJson(res);
  const type = j?.responseStatus?.type;
  if (type === "SUCCESSFUL") return { status: "ok", tokens: await complete(jar, j.serviceTicketId) };
  if (type === "MFA_REQUIRED") {
    return { status: "mfa", state: { cookies: jar.cookies, mfaMethod: j?.customerMfaInfo?.mfaLastMethodUsed || "email" } };
  }
  throw new GarminError(`Garmin login failed: ${type ?? "unknown"} ${j?.responseStatus?.message ?? ""}`.trim());
}

export async function verifyMfa(state: MfaState, code: string): Promise<GarminTokens> {
  const jar = new Jar(state.cookies);
  const res = await ssoFetch(jar, `https://sso.${DOMAIN}/mobile/api/mfa/verifyCode?${loginParams()}`, {
    method: "POST",
    headers: { ...SSO_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ mfaMethod: state.mfaMethod, mfaVerificationCode: code, rememberMyBrowser: false, reconsentList: [], mfaSetup: false }),
  });
  const j = await ssoJson(res);
  if (j?.responseStatus?.type !== "SUCCESSFUL") throw new GarminError(`MFA failed: ${j?.responseStatus?.type ?? "unknown"}`);
  return complete(jar, j.serviceTicketId);
}

// ---------------- API ----------------
export class Garmin {
  /** Set to true when tokens were refreshed and must be persisted. */
  refreshed = false;
  constructor(public tokens: GarminTokens) {}

  private async bearer() {
    if (this.tokens.oauth2.expires_at < Date.now() / 1000 + 60) {
      this.tokens = { ...this.tokens, oauth2: await exchange(this.tokens.oauth1) };
      this.refreshed = true;
    }
    return `Bearer ${this.tokens.oauth2.access_token}`;
  }

  async api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const headers: Record<string, string> = { "User-Agent": API_UA, Authorization: await this.bearer() };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(`https://connectapi.${DOMAIN}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (r.status === 204) return null as T;
    if (r.status === 401) throw new GarminError("Garmin session expired - reconnect Garmin in Settings", 401);
    if (r.status === 429) throw new GarminError("Garmin rate limit - will retry on next sync", 429);
    if (!r.ok) throw new GarminError(`Garmin API ${path.split("?")[0]} -> ${r.status}`, r.status);
    const text = await r.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  profile() {
    return this.api<{ displayName: string; fullName?: string }>("/userprofile-service/socialProfile");
  }
  activities(start: number, limit = 100) {
    return this.api<any[]>(`/activitylist-service/activities/search/activities?start=${start}&limit=${limit}`);
  }
  splits(activityId: string | number) {
    return this.api<any>(`/activity-service/activity/${activityId}/splits`);
  }
  hrv(date: string) {
    return this.api<any>(`/hrv-service/hrv/${date}`).catch(() => null);
  }
  sleep(displayName: string, date: string) {
    return this.api<any>(`/wellness-service/wellness/dailySleepData/${encodeURIComponent(displayName)}?date=${date}&nonSleepBufferMinutes=60`).catch(() => null);
  }
  bodyBattery(start: string, end: string) {
    return this.api<any[]>(`/wellness-service/wellness/bodyBattery/reports/daily?startDate=${start}&endDate=${end}`).catch(() => []);
  }
  readiness(date: string) {
    return this.api<any[]>(`/metrics-service/metrics/trainingreadiness/${date}`).catch(() => []);
  }
  userSummary(displayName: string, date: string) {
    return this.api<any>(`/usersummary-service/usersummary/daily/${encodeURIComponent(displayName)}?calendarDate=${date}`).catch(() => null);
  }
  createWorkout(workout: unknown) {
    return this.api<{ workoutId: number }>("/workout-service/workout", { method: "POST", body: workout });
  }
  scheduleWorkout(workoutId: number, date: string) {
    return this.api<{ workoutScheduleId?: number }>(`/workout-service/schedule/${workoutId}`, { method: "POST", body: { date } });
  }
  deleteWorkout(workoutId: number) {
    return this.api(`/workout-service/workout/${workoutId}`, { method: "DELETE" }).catch(() => null);
  }
}
