import type { Text } from "./types";

export interface SyncProblem { text: Text; reconnect: boolean; raw: string }

/** Turns the last sync's error strings into one plain explanation and what to do about it. */
export function syncProblem(errors: string[] | undefined): SyncProblem | null {
  if (!errors?.length) return null;
  const raw = errors.join("; ");
  const garmin = errors.filter((e) => /^(push|garmin|wellness):/.test(e));
  if (garmin.some((e) => /session expired|INVALID|reconnect/i.test(e))) {
    return {
      reconnect: true, raw,
      text: {
        en: "The Garmin connection has expired. Reconnect once in Settings (your data stays).",
        he: "החיבור ל-Garmin פג. צריך להתחבר מחדש פעם אחת בהגדרות (הנתונים נשמרים).",
      },
    };
  }
  if (garmin.some((e) => /rate|blocked|HTTP 4(03|27|29)|-> 4(03|27|29)/i.test(e))) {
    return {
      reconnect: false, raw,
      text: {
        en: "Garmin is temporarily blocking requests from the app. The next sync will try again - wait ~15 minutes.",
        he: "Garmin חוסם זמנית בקשות מהאפליקציה. הסנכרון הבא ינסה שוב - כדאי לחכות כרבע שעה.",
      },
    };
  }
  if (garmin.length) {
    return { reconnect: false, raw, text: { en: `Garmin sync failed: ${garmin[0]}`, he: `הסנכרון עם Garmin נכשל: ${garmin[0]}` } };
  }
  return { reconnect: /strava.*(401|expired)/i.test(raw), raw, text: { en: `Strava sync failed: ${errors[0]}`, he: `הסנכרון עם Strava נכשל: ${errors[0]}` } };
}
