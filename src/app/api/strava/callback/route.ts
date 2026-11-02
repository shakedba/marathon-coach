import { NextResponse, type NextRequest } from "next/server";
import { encrypt } from "@/lib/crypto";
import * as db from "@/lib/db";
import { exchangeCode } from "@/lib/strava/client";
import { appOrigin } from "@/lib/origin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("strava_state")?.value;
  const fail = () => NextResponse.redirect(new URL("/settings?strava=error", appOrigin(req.headers)));
  // `state` binds the callback to the browser that started the flow (prevents login-CSRF).
  if (!code || !state || !expected || state !== expected) return fail();
  try {
    await db.kvSet("strava_tokens", encrypt(await exchangeCode(code)));
    const res = NextResponse.redirect(new URL("/settings", appOrigin(req.headers)));
    res.cookies.delete("strava_state");
    return res;
  } catch {
    return fail();
  }
}
