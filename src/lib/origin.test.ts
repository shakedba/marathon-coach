import { afterEach, describe, expect, it } from "vitest";
import { appOrigin } from "./origin";

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
