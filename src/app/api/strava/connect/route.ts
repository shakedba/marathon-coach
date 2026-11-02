import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { appOrigin } from "@/lib/origin";
import { authorizeUrl } from "@/lib/strava/client";

export async function GET(req: Request) {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(`${appOrigin(req.headers)}/api/strava/callback`, state));
  res.cookies.set("strava_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/strava", maxAge: 600 });
  return res;
}
