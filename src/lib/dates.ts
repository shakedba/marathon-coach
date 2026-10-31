/** Date helpers working on plain YYYY-MM-DD strings (no timezone drift). */

export const TZ = "Asia/Jerusalem";

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const da = Date.parse(a + "T12:00:00Z");
  const db = Date.parse(b + "T12:00:00Z");
  return Math.round((da - db) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: string): number {
  return new Date(date + "T12:00:00Z").getUTCDay();
}

/** Training weeks run Monday..Sunday. */
export function weekStart(date: string): string {
  const wd = weekday(date);
  return addDays(date, -((wd + 6) % 7));
}

export function todayLocal(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function fmtPace(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

export function parsePace(p: string): number {
  const [m, s] = p.split(":").map(Number);
  return m * 60 + s;
}
