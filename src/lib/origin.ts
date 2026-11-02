/**
 * The public origin the browser used (e.g. https://marathon-coach-r9yk.vercel.app).
 * APP_URL wins if set; otherwise the proxy's forwarded host, then Host.
 */
export function appOrigin(h: Headers): string {
  const fixed = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto}://${host}`;
}
