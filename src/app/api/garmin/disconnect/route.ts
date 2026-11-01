import { NextResponse } from "next/server";
import * as db from "@/lib/db";

export async function POST(req: Request) {
  for (const k of ["garmin_tokens", "garmin_profile", "garmin_mfa"]) await db.kvDel(k);
  return NextResponse.redirect(new URL("/settings", req.url), 303);
}
