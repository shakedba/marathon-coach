import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { canonicalRedirect } from "@/lib/origin";

const PUBLIC = new Set(["/login", "/api/login", "/api/cron/sync", "/manifest.webmanifest", "/icon.svg"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // One address only: Vercel also serves production on aliases like *-git-main-*.vercel.app,
  // which breaks the Strava callback domain and splits the login cookie. Cron calls are left alone.
  if (pathname !== "/api/cron/sync") {
    const to = canonicalRedirect(req.nextUrl, req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
    if (to) return NextResponse.redirect(to, 308);
  }
  if (PUBLIC.has(pathname)) return NextResponse.next();
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
