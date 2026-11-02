/**
 * The public origin the browser used (e.g. https://marathon-coach-r9yk.vercel.app).
 * APP_URL wins if set; otherwise the proxy's forwarded host, then Host.
 */
export function appOrigin(h: Headers): string {
  const fixed = canonicalOrigin();
  if (fixed) return fixed;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

/**
 * The one address the app should be used from (cookies, Strava callback domain).
 * APP_URL if set; on Vercel production, the project's production domain
 * (VERCEL_PROJECT_PRODUCTION_URL, e.g. marathon-coach-r9yk.vercel.app). Null elsewhere (previews, local).
 */
export function canonicalOrigin(env: Record<string, string | undefined> = process.env): string | null {
  const fixed = env.APP_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`;
  return null;
}

/** Where to send a request that arrived on a secondary address (e.g. *-git-main-*.vercel.app), or null to serve it. */
export function canonicalRedirect(url: URL, host: string | null, env?: Record<string, string | undefined>): URL | null {
  const canonical = canonicalOrigin(env);
  if (!canonical || !host) return null;
  const c = new URL(canonical);
  if (host.toLowerCase() === c.host.toLowerCase()) return null;
  const target = new URL(url.pathname + url.search, c);
  return target;
}
