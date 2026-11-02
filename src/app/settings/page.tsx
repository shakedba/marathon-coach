import { deleteEverything, setLang, syncNow } from "../actions";
import { GarminConnect } from "@/components/GarminConnect";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { StravaConnectLink } from "@/components/StravaConnectLink";
import { PostButton } from "@/components/PostButton";
import { Setup } from "@/components/Setup";
import * as db from "@/lib/db";
import { dbConfigured } from "@/lib/data";
import { tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { headers } from "next/headers";
import { appOrigin } from "@/lib/origin";
import { stravaClientId } from "@/lib/strava/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const lang = await getLang();
  const t = tr(lang);
  const sp = await searchParams;
  const langForm = (
    <ActionForm action={setLang} success={{ he: "השפה שונתה", en: "Language changed" }} error={t("fb_failed")} className="row">
      <SubmitButton name="lang" value="he" primary={lang === "he"}>עברית</SubmitButton>
      <SubmitButton name="lang" value="en" primary={lang === "en"}>English</SubmitButton>
    </ActionForm>
  );
  if (!dbConfigured()) return (<><h1>{t("settings")}</h1>{langForm}<Setup /></>);
  const origin = appOrigin(await headers());
  const [garmin, strava, gh, sh, counts, profile] = await Promise.all([
    db.kvGet<string>("garmin_tokens"), db.kvGet<string>("strava_tokens"),
    db.kvGet<{ start: number; done: boolean; wellnessBackTo?: string }>("garmin_history"), db.kvGet<{ page: number; done: boolean }>("strava_history"),
    db.activityCount(), db.kvGet<{ displayName: string }>("garmin_profile"),
  ]);
  return (
    <>
      <h1>{t("settings")}</h1>
      <div className="card"><h2 style={{ marginTop: 0 }}>{t("language")}</h2>{langForm}</div>

      <div className="card">
        <div className="spread"><h2 style={{ margin: 0 }}>Garmin</h2><span className={`tag ${garmin ? "done" : "missed"}`}>{garmin ? t("connected") : t("notConnected")}</span></div>
        {garmin ? (
          <>
            <p className="muted">{profile?.displayName ?? ""} · {gh?.done ? `${t("history")} ✓` : `${t("history")}: ${gh?.start ?? 0}…`} {gh?.wellnessBackTo ? `· ${t("recovery")} ${t("since")} ${gh.wellnessBackTo}` : ""}</p>
            <p className="muted">{t("pushNote")}</p>
            <PostButton action="/api/garmin/disconnect" label={lang === "he" ? "נתק Garmin" : "Disconnect Garmin"} pending={lang === "he" ? "מנתק…" : "Disconnecting…"} confirm={lang === "he" ? "לנתק את Garmin? הנתונים שכבר יובאו יישארו." : "Disconnect Garmin? Data already imported stays."} />
          </>
        ) : (
          <GarminConnect labels={{ email: t("email"), password: t("password"), mfaCode: t("mfaCode"), connect: t("connectGarmin"), pwNote: t("pwNote"), typeNote: t("typeNote"), connecting: t("fb_connecting"), firstSync: t("fb_firstSync"), connected: t("connected"), failed: t("fb_failed") }} />
        )}
        <p className="muted">{t("unofficial")}</p>
      </div>

      <div className="card">
        <div className="spread"><h2 style={{ margin: 0 }}>Strava</h2><span className={`tag ${strava ? "done" : "missed"}`}>{strava ? t("connected") : t("notConnected")}</span></div>
        {sp.strava === "error" && <p style={{ color: "var(--bad)" }}>Strava connection failed.</p>}
        {!strava && (
          <details open={sp.strava === "error"} style={{ margin: "8px 0" }}>
            <summary className="muted">{lang === "he" ? "בדיקת הגדרות Strava" : "Check Strava settings"}</summary>
            <table className="ltr" style={{ fontSize: ".85rem" }}>
              <tbody>
                <tr><td>Client ID</td><td><b>{stravaClientId() ?? "— not set —"}</b></td></tr>
                <tr><td>Callback domain</td><td><b>{origin.replace(/^https?:\/\//, "")}</b></td></tr>
                <tr><td>Redirect URI</td><td style={{ wordBreak: "break-all" }}>{origin}/api/strava/callback</td></tr>
              </tbody>
            </table>
            <p className="muted">{lang === "he"
              ? "ב-strava.com/settings/api: ה-Client ID חייב להיות זהה, וה-Authorization Callback Domain חייב להיות בדיוק השורה השנייה."
              : "On strava.com/settings/api the Client ID must match, and Authorization Callback Domain must be exactly the second row."}</p>
          </details>
        )}
        {strava ? <p className="muted">{sh?.done ? `${t("history")} ✓` : `${t("history")}: page ${sh?.page ?? 1}…`}</p> : <StravaConnectLink label={t("connectStrava")} pending={t("fb_connecting")} />}
      </div>

      <div className="card">
        <p className="muted">{counts.map((c) => `${c.source}: ${c.n} ${t("activities")}${c.first ? ` ${t("since")} ${c.first}` : ""}`).join(" · ") || t("noRuns")}</p>
        <ActionForm action={syncNow} success={t("fb_synced")} error={t("fb_failed")}>
          <SubmitButton primary pendingLabel={t("fb_syncing")}>{t("syncNow")}</SubmitButton>
        </ActionForm>
        <p className="muted">{lang === "he" ? "ייבוא כל ההיסטוריה נעשה בשלבים - לחץ 'סנכרן' כמה פעמים או המתן לסנכרון היומי." : "Full history imports in chunks - tap Sync a few times or let the daily sync finish it."}</p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{lang === "he" ? "פרטיות" : "Privacy"}</h2>
        <p className="muted">{lang === "he"
          ? "נשמרים רק סיכומי ריצות (מרחק, זמן, דופק, הקפות) ונתוני התאוששות. לא נשמרים מסלולי GPS. הטוקנים מוצפנים (AES-256-GCM)."
          : "Only run summaries (distance, time, HR, laps) and recovery data are stored. No GPS tracks. Tokens are encrypted (AES-256-GCM)."}</p>
        <ActionForm action={deleteEverything} success={t("fb_deleted")} error={t("fb_failed")} confirm={t("fb_deleteConfirm")} className="row">
          <input name="confirm" placeholder="DELETE" dir="ltr" style={{ width: 140 }} />
          <SubmitButton>{lang === "he" ? "מחק את כל הנתונים" : "Delete all data"}</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
