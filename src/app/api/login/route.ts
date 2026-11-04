import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import * as db from "@/lib/db";
import { dbConfigured } from "@/lib/data";

export async function POST(req: Request) {
  const back = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  // Preview deployments have no database on purpose (they must never touch real data): say so instead of a 500.
  if (!dbConfigured()) return back("/login?e=nodb");
  if (await db.loginBlocked()) return back("/login?e=locked");
  const form = await req.formData();
  // Compare fixed-length digests so neither length nor content leaks through timing.
  const h = (s: string) => crypto.createHash("sha256").update(s).digest();
  const want = process.env.APP_PASSWORD ?? "";
  const ok = want.length >= 8 && crypto.timingSafeEqual(h(String(form.get("password") ?? "")), h(want));
  await db.recordLogin(ok);
  if (!ok) return back("/login?e=1");
  const res = back("/");
  res.cookies.set(SESSION_COOKIE, await sessionToken(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}
