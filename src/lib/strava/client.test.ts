import { afterEach, describe, expect, it, vi } from "vitest";
import { mapStrava, parseStravaJson, Strava, stravaId } from "./client";

const farFuture = Math.floor(Date.now() / 1000) + 86_400;
const run = { start_date_local: "2026-11-17T05:50:55Z", sport_type: "Run", name: "Morning Run", distance: 6007.9, moving_time: 2050 };

afterEach(() => vi.unstubAllGlobals());

describe("Strava 64-bit ids", () => {
  it("keeps an id above 2^53 exact end to end (raw JSON text, not a JS number)", async () => {
    // Written as raw text on purpose: JSON.stringify of a JS number would corrupt it before the test starts.
    const body = '[{"id":9007199254740993,"name":"a","start_date_local":"2026-11-17T05:50:55Z"},{"id":9007199254740992,"name":"b","start_date_local":"2026-11-17T06:50:55Z"}]';
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    const s = new Strava({ access_token: "x", refresh_token: "y", expires_at: farFuture });
    const acts = (await s.activities(1)).map((a) => mapStrava({ ...run, ...a }));
    expect(acts.map((a) => a?.id)).toEqual(["strava:9007199254740993", "strava:9007199254740992"]);
  });

  it("handles ids up to the unsigned 64-bit maximum and string ids", () => {
    expect(parseStravaJson('[{"id":18446744073709551615,"athlete":{"id":1234567890123456789}}]')[0].id).toBe("18446744073709551615");
    expect(mapStrava({ ...run, id: "18446744073709551615" })?.id).toBe("strava:18446744073709551615");
  });

  it("leaves other numbers alone", () => {
    expect(parseStravaJson('{"id":21017022115,"distance":6007.9,"n":1.50}')).toEqual({ id: "21017022115", distance: 6007.9, n: 1.5 });
  });

  it("rejects an id that has already lost precision, instead of storing a wrong key", () => {
    expect(stravaId(2 ** 53 + 2)).toBeNull();
    expect(stravaId(21017022115)).toBe("21017022115");
    expect(stravaId("12a")).toBeNull();
    expect(stravaId(undefined)).toBeNull();
    expect(mapStrava({ ...run, id: 2 ** 53 + 2 })).toBeNull();
  });
});
