/**
 * Unofficial Garmin Connect client. Not endorsed by Garmin; endpoints may change.
 *
 * Follows the login flow of the maintained `python-garminconnect` (0.3.20, Nov 2026),
 * after Garmin retired the old OAuth1 flow that `garth` used (March 2026):
 *   1. GET the iOS mobile sign-in page (sets SSO + Cloudflare cookies)
 *   2. short pause, then POST credentials to /mobile/api/login with Origin + Referer
 *   3. optional MFA: POST /mobile/api/mfa/verifyCode (portal endpoint as fallback)
 *   4. exchange the CAS service ticket for a DI OAuth2 bearer token (diauth.garmin.com)
 *   5. refresh with the DI refresh token
 */

const DOMAIN = "garmin.com";
const SSO = `https://sso.${DOMAIN}`;
const IOS_CLIENT_ID = "GCM_IOS_DARK";
const IOS_SERVICE_URL = `https://mobile.integration.${DOMAIN}/gcm/ios`;
const PORTAL_CLIENT_ID = "GarminConnect";
const PORTAL_SERVICE_URL = `https://connect.${DOMAIN}/app`;
const IOS_LOGIN_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const DI_TOKEN_URL = `https://diauth.${DOMAIN}/di-oauth2-service/oauth/token`;
const DI_GRANT_TYPE = "https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket";
const DI_CLIENT_IDS = [
  "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
  "GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4",
  "GARMIN_CONNECT_MOBILE_ANDROID_DI",
  "GARMIN_CONNECT_MOBILE_IOS_DI",
];
const BLOCKED = new Set([427, 429]);

/** Headers the Garmin Connect Android app sends to the API tier. */
export function nativeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "User-Agent": "GCM-Android-5.23",
    "X-Garmin-User-Agent": "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
    "X-Garmin-Paired-App-Version": "10861",
    "X-Garmin-Client-Platform": "Android",
    "X-App-Ver": "10861",
    "X-Lang": "en",
    "X-GCExperience": "GC5",
    "Accept-Language": "en-US,en;q=0.9",
    ...extra,
  };
}

export interface GarminTokens {
  access_token: string;
  refresh_token?: string;
  client_id: string;
  expires_at: number; // unix seconds
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

// ---------------- helpers ----------------
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
const IOS_PARAMS = { clientId: IOS_CLIENT_ID, locale: "en-US", service: IOS_SERVICE_URL };
const SIGNIN_URL = `${SSO}/mobile/sso/en_US/sign-in?${qs({ clientId: IOS_CLIENT_ID, service: IOS_SERVICE_URL })}`;
const POST_HEADERS: Record<string, string> = {
  "User-Agent": IOS_LOGIN_UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/json",
  Origin: SSO,
  Referer: SIGNIN_URL,
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function jwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}
function jwtClientId(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.client_id ? String(payload.client_id) : null;
  } catch {
    return null;
  }
}

async function readSso(res: Response, what: string) {
  if (BLOCKED.has(res.status)) throw new GarminError(`${what}: Garmin rate-limited or blocked this server (HTTP ${res.status}). Wait 15 minutes and try once.`, res.status);
  if (res.status === 403) throw new GarminError(`${what}: blocked by Garmin's bot protection (HTTP 403).`, 403);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new GarminError(`${what}: Garmin returned a non-JSON response (HTTP ${res.status}); it may be blocking this server.`, res.status);
  }
}

// ---------------- DI OAuth2 ----------------
async function diTokenPost(clientId: string, accept: string, data: Record<string, string>) {
  return fetch(DI_TOKEN_URL, {
    method: "POST",
    headers: nativeHeaders({
      Authorization: "Basic " + Buffer.from(`${clientId}:`).toString("base64"),
      Accept: accept,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    }),
    body: new URLSearchParams(data).toString(),
  });
}

function toTokens(data: any, clientId: string): GarminTokens {
  const access = String(data.access_token);
  const exp = jwtExp(access) ?? Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600);
  return { access_token: access, refresh_token: data.refresh_token, client_id: jwtClientId(access) ?? clientId, expires_at: exp };
}

export async function exchangeTicket(ticket: string, serviceUrl = IOS_SERVICE_URL): Promise<GarminTokens> {
  for (const clientId of DI_CLIENT_IDS) {
    const r = await diTokenPost(clientId, "application/json,text/html;q=0.9,*/*;q=0.8", {
      client_id: clientId,
      service_ticket: ticket,
      grant_type: DI_GRANT_TYPE,
      service_url: serviceUrl,
    });
    if (r.status === 429) throw new GarminError("Garmin token exchange rate-limited; try again in 15 minutes.", 429);
    if (!r.ok) continue;
    try {
      const data = await r.json();
      if (data?.access_token) return toTokens(data, clientId);
    } catch {
      /* try next client id */
    }
  }
  throw new GarminError("Garmin token exchange failed for all client IDs.");
}

export async function refreshTokens(t: GarminTokens): Promise<GarminTokens> {
  if (!t.refresh_token) throw new GarminError("Garmin session expired - reconnect Garmin in Settings", 401);
  const r = await diTokenPost(t.client_id, "application/json", { grant_type: "refresh_token", client_id: t.client_id, refresh_token: t.refresh_token });
  if (!r.ok) throw new GarminError(`Garmin session expired - reconnect Garmin in Settings (refresh ${r.status})`, 401);
  const data = await r.json();
  const next = toTokens(data, t.client_id);
  return { ...next, refresh_token: next.refresh_token ?? t.refresh_token };
}

// ---------------- SSO login ----------------
export type LoginResult = { status: "ok"; tokens: GarminTokens } | { status: "mfa"; state: MfaState };

async function postCredentials(jar: Jar, email: string, password: string) {
  const res = await ssoFetch(jar, `${SSO}/mobile/api/login?${qs(IOS_PARAMS)}`, {
    method: "POST",
    headers: POST_HEADERS,
    body: JSON.stringify({ username: email, password, rememberMe: true, captchaToken: "" }),
  });
  return readSso(res, "Garmin login");
}

export async function login(email: string, password: string, opts: { delayMs?: number } = {}): Promise<LoginResult> {
  const jar = new Jar();
  const page = await ssoFetch(jar, SIGNIN_URL, {
    headers: { "User-Agent": IOS_LOGIN_UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (BLOCKED.has(page.status)) throw new GarminError(`Garmin sign-in page: rate-limited or blocked (HTTP ${page.status}). Wait 15 minutes and try once.`, page.status);
  if (page.status === 403) throw new GarminError("Garmin sign-in page: blocked by Garmin's bot protection (HTTP 403).", 403);
  // Cloudflare flags an instant GET->POST as bot-like; the real app pauses.
  await sleep(opts.delayMs ?? 2000 + Math.random() * 3000);

  let j = await postCredentials(jar, email, password);
  let type = j?.responseStatus?.type;
  // Password managers sometimes copy a trailing space/newline; browsers forgive it, this endpoint doesn't.
  if (type === "INVALID_USERNAME_PASSWORD" && password !== password.trim()) {
    j = await postCredentials(jar, email, password.trim());
    type = j?.responseStatus?.type;
  }
  if (type === "SUCCESSFUL") return { status: "ok", tokens: await exchangeTicket(j.serviceTicketId) };
  if (type === "MFA_REQUIRED") return { status: "mfa", state: { cookies: jar.cookies, mfaMethod: j?.customerMfaInfo?.mfaLastMethodUsed || "email" } };
  if (type === "INVALID_USERNAME_PASSWORD") throw new GarminError("Garmin rejected the email or password (INVALID_USERNAME_PASSWORD).", 401);
  if (type === "CAPTCHA_REQUIRED") throw new GarminError("Garmin asked for a CAPTCHA (bot check). Wait 15 minutes and try once.");
  if (j?.error?.["status-code"] === "429") throw new GarminError("Garmin rate-limited this server. Wait 15 minutes and try once.", 429);
  throw new GarminError(`Garmin login failed: ${type ?? "unknown response"}`);
}

export async function verifyMfa(state: MfaState, code: string): Promise<GarminTokens> {
  const jar = new Jar(state.cookies);
  const body = JSON.stringify({ mfaMethod: state.mfaMethod, mfaVerificationCode: code, rememberMyBrowser: true, reconsentList: [], mfaSetup: false });
  const endpoints: [string, string][] = [
    [`${SSO}/mobile/api/mfa/verifyCode?${qs(IOS_PARAMS)}`, IOS_SERVICE_URL],
    [`${SSO}/portal/api/mfa/verifyCode?${qs({ clientId: PORTAL_CLIENT_ID, locale: "en-US", service: PORTAL_SERVICE_URL })}`, PORTAL_SERVICE_URL],
  ];
  const failures: string[] = [];
  for (const [url, service] of endpoints) {
    let j: any;
    try {
      j = await readSso(await ssoFetch(jar, url, { method: "POST", headers: POST_HEADERS, body }), "Garmin verification");
    } catch (e) {
      failures.push((e as Error).message);
      continue;
    }
    if (j?.responseStatus?.type === "SUCCESSFUL") return exchangeTicket(j.serviceTicketId, service);
    failures.push(j?.responseStatus?.type ?? "unknown");
    if (j?.responseStatus?.type && j.responseStatus.type !== "SUCCESSFUL") break; // a real answer (e.g. wrong code): don't retry
  }
  throw new GarminError(`Verification failed: ${failures.join("; ")}`);
}

// ---------------- API ----------------
export class Garmin {
  /** Set to true when tokens were refreshed and not yet persisted (no onRefresh callback). */
  refreshed = false;
  private refreshing: Promise<void> | null = null;

  /**
   * @param onRefresh persists refreshed tokens right away. Garmin's DI refresh token rotates: once used, the old one
   *   is dead, so new tokens must be saved before anything else can fail or time out.
   */
  constructor(public tokens: GarminTokens, private onRefresh?: (t: GarminTokens) => Promise<void>) {}

  /** One refresh at a time: parallel calls must not spend the same (single-use) refresh token twice. */
  private refresh(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        this.tokens = await refreshTokens(this.tokens);
        this.refreshed = true;
        if (this.onRefresh) {
          await this.onRefresh(this.tokens);
          this.refreshed = false;
        }
      })().finally(() => { this.refreshing = null; });
    }
    return this.refreshing;
  }

  private async bearer() {
    if (this.refreshing) await this.refreshing;
    if (this.tokens.expires_at < Date.now() / 1000 + 120) await this.refresh();
    return `Bearer ${this.tokens.access_token}`;
  }

  async api<T = any>(path: string, init: { method?: string; body?: unknown } = {}, retried = false): Promise<T> {
    const headers = nativeHeaders({ Authorization: await this.bearer(), Accept: "application/json" });
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(`https://connectapi.${DOMAIN}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (r.status === 204) return null as T;
    // The access token can be revoked before its expiry: refresh once and retry before giving up.
    if (r.status === 401 && !retried && this.tokens.refresh_token) {
      await this.refresh();
      return this.api<T>(path, init, true);
    }
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
  trainingStatus(date: string) {
    return this.api<any>(`/metrics-service/metrics/trainingstatus/aggregated/${date}`).catch(() => null);
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
