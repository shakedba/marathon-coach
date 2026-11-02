import { afterEach, describe, expect, it, vi } from "vitest";
import { Garmin, jwtExp, login, verifyMfa } from "./client";

const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const ACCESS = jwt({ exp: 2_000_000_000, client_id: "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2" });

type Call = { url: string; method: string; headers: Headers; body?: string };
function fakeGarmin(loginReplies: object[], opts: { signinStatus?: number; diFailFirst?: boolean } = {}) {
  const calls: Call[] = [];
  let i = 0;
  let di = 0;
  const res = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: extra });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers), body: init.body as string | undefined });
    if (url.includes("/mobile/sso/en_US/sign-in")) return res("<html>", opts.signinStatus ?? 200, { "set-cookie": "SESSION=abc; Path=/" });
    if (url.includes("/api/login") || url.includes("/mfa/verifyCode")) return res(loginReplies[Math.min(i++, loginReplies.length - 1)]);
    if (url.includes("diauth.garmin.com")) {
      di++;
      if (opts.diFailFirst && di === 1) return res("nope", 400);
      return res({ access_token: ACCESS, refresh_token: "r1", expires_in: 3600 });
    }
    if (url.includes("connectapi.garmin.com")) return res({ displayName: "shaked" });
    return res("not found", 404);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Garmin login (current mobile iOS + DI OAuth2 flow)", () => {
  it("loads the iOS sign-in page, posts credentials with Origin/Referer + cookies, exchanges the ticket", async () => {
    const calls = fakeGarmin([{ responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-1" }]);
    const r = await login("me@example.com", "pw", { delayMs: 0 });
    expect(r.status).toBe("ok");
    const [page, post, di] = calls;
    expect(page.url).toContain("clientId=GCM_IOS_DARK");
    expect(post.url).toContain("/mobile/api/login?clientId=GCM_IOS_DARK&locale=en-US");
    expect(post.headers.get("origin")).toBe("https://sso.garmin.com");
    expect(post.headers.get("referer")).toContain("/mobile/sso/en_US/sign-in");
    expect(post.headers.get("cookie")).toContain("SESSION=abc");
    expect(JSON.parse(post.body!)).toMatchObject({ username: "me@example.com", password: "pw", rememberMe: true });
    expect(di.url).toBe("https://diauth.garmin.com/di-oauth2-service/oauth/token");
    expect(di.headers.get("authorization")).toBe("Basic " + Buffer.from("GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2:").toString("base64"));
    expect(new URLSearchParams(di.body!).get("service_ticket")).toBe("ST-1");
    if (r.status === "ok") {
      expect(r.tokens.expires_at).toBe(2_000_000_000);
      expect(r.tokens.refresh_token).toBe("r1");
    }
  });

  it("tries the next DI client id when one is refused", async () => {
    const calls = fakeGarmin([{ responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-1" }], { diFailFirst: true });
    const r = await login("me@example.com", "pw", { delayMs: 0 });
    expect(r.status).toBe("ok");
    expect(calls.filter((c) => c.url.includes("diauth")).length).toBe(2);
  });

  it("retries once with a trimmed password if the manager added whitespace", async () => {
    const calls = fakeGarmin([{ responseStatus: { type: "INVALID_USERNAME_PASSWORD" } }, { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-2" }]);
    const r = await login("me@example.com", "pw \n", { delayMs: 0 });
    expect(r.status).toBe("ok");
    const posts = calls.filter((c) => c.url.includes("/api/login"));
    expect(posts.map((p) => JSON.parse(p.body!).password)).toEqual(["pw \n", "pw"]);
  });

  it("does not retry a clean password (no extra attempts toward a lockout)", async () => {
    const calls = fakeGarmin([{ responseStatus: { type: "INVALID_USERNAME_PASSWORD" } }]);
    await expect(login("me@example.com", "pw", { delayMs: 0 })).rejects.toThrow(/rejected the email or password/);
    expect(calls.filter((c) => c.url.includes("/api/login")).length).toBe(1);
  });

  it("maps rate limiting / blocking to a clear message", async () => {
    fakeGarmin([], { signinStatus: 429 });
    await expect(login("me@example.com", "pw", { delayMs: 0 })).rejects.toThrow(/rate-limited or blocked/);
  });

  it("MFA: returns state, then verifyCode on the mobile endpoint with the same cookies", async () => {
    const calls = fakeGarmin([
      { responseStatus: { type: "MFA_REQUIRED" }, customerMfaInfo: { mfaLastMethodUsed: "email" } },
      { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-3" },
    ]);
    const r = await login("me@example.com", "pw", { delayMs: 0 });
    expect(r.status).toBe("mfa");
    if (r.status !== "mfa") return;
    const t = await verifyMfa(r.state, "123456");
    expect(t.access_token).toBe(ACCESS);
    const mfa = calls.find((c) => c.url.includes("/mobile/api/mfa/verifyCode"))!;
    expect(mfa.headers.get("cookie")).toContain("SESSION=abc");
    expect(JSON.parse(mfa.body!)).toMatchObject({ mfaMethod: "email", mfaVerificationCode: "123456" });
  });

  it("API calls use the bearer token and native app headers", async () => {
    const calls = fakeGarmin([]);
    const g = new Garmin({ access_token: ACCESS, refresh_token: "r1", client_id: "X", expires_at: 2_000_000_000 });
    expect((await g.profile()).displayName).toBe("shaked");
    const c = calls[0];
    expect(c.headers.get("authorization")).toBe(`Bearer ${ACCESS}`);
    expect(c.headers.get("x-garmin-client-platform")).toBe("Android");
  });

  it("refreshes an expired token with the refresh token", async () => {
    const calls = fakeGarmin([]);
    const g = new Garmin({ access_token: "old", refresh_token: "r0", client_id: "CID", expires_at: 1 });
    await g.profile();
    expect(g.refreshed).toBe(true);
    const ref = new URLSearchParams(calls[0].body!);
    expect(ref.get("grant_type")).toBe("refresh_token");
    expect(ref.get("refresh_token")).toBe("r0");
    expect(jwtExp(g.tokens.access_token)).toBe(2_000_000_000);
  });
});
