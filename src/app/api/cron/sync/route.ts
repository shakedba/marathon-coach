import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

export const maxDuration = 60;

/** Daily Vercel cron. Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await syncAll());
}
