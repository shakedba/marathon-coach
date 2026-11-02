import { afterEach, describe, expect, it } from "vitest";
import { appOrigin, canonicalRedirect } from "./origin";

afterEach(() => { delete process.env.APP_URL; });

describe("appOrigin", () => {
  it("uses the forwarded host the browser used", () => {
    expect(appOrigin(new Headers({ "x-forwarded-host": "marathon-coach-r9yk.vercel.app", "x-forwarded-proto": "https", host: "internal:3000" })))
      .toBe("https://marathon-coach-r9yk.vercel.app");
  });
  it("falls back to Host", () => {
    expect(appOrigin(new Headers({ host: "marathon-coach-r9yk.vercel.app" }))).toBe("https://marathon-coach-r9yk.vercel.app");
  });
  it("APP_URL overrides and loses a trailing slash", () => {
    process.env.APP_URL = "https://example.app/ ";
    expect(appOrigin(new Headers({ host: "x" }))).toBe("https://example.app");
  });
});

describe("canonical address", () => {
  const prod = { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "marathon-coach-r9yk.vercel.app" };
  const u = new URL("https://marathon-coach-r9yk-git-main-sahked.vercel.app/settings?strava=error");
  it("redirects the git-main alias to the production domain, keeping path and query", () => {
    expect(canonicalRedirect(u, "marathon-coach-r9yk-git-main-sahked.vercel.app", prod)?.toString())
      .toBe("https://marathon-coach-r9yk.vercel.app/settings?strava=error");
  });
  it("serves requests already on the production domain", () => {
    expect(canonicalRedirect(u, "marathon-coach-r9yk.vercel.app", prod)).toBeNull();
  });
  it("never redirects previews or local runs", () => {
    expect(canonicalRedirect(u, "x-git-branch.vercel.app", { VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "a.vercel.app" })).toBeNull();
    expect(canonicalRedirect(u, "localhost:3000", {})).toBeNull();
  });
});
