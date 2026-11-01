import { deleteEverything, setLang, syncNow } from "../actions";
import { GarminConnect } from "@/components/GarminConnect";
import { Setup } from "@/components/Setup";
import * as db from "@/lib/db";
import { dbConfigured } from "@/lib/data";
import { tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ strava?: string }> }) {
  const lang = await getLang();
  const t = tr(lang);
  const sp = await searchParams;
  const langForm = (
    <form action={setLang} className="row">
      <button name="lang" value="he" className={lang === "he" ? "primary" : ""}>עברית</button>
      <button name="lang" value="en" className={lang === "en" ? "primary" : ""}>English</button>
    </form>
  );
  if (!dbConfigured()) return (<><h1>{t("settings")}</h1>{langForm}<Setup /></>);
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
            <form action="/api/garmin/disconnect" method="post"><button>Disconnect</button></form>
          </>
        ) : (
          <GarminConnect labels={{ email: t("email"), password: t("password"), mfaCode: t("mfaCode"), connect: t("connectGarmin"), pwNote: t("pwNote"), typeNote: t("typeNote") }} />
        )}
        <p className="muted">{t("unofficial")}</p>
      </div>

      <div className="card">
        <div className="spread"><h2 style={{ margin: 0 }}>Strava</h2><span className={`tag ${strava ? "done" : "missed"}`}>{strava ? t("connected") : t("notConnected")}</span></div>
        {sp.strava === "error" && <p style={{ color: "var(--bad)" }}>Strava connection failed.</p>}
        {strava ? <p className="muted">{sh?.done ? `${t("history")} ✓` : `${t("history")}: page ${sh?.page ?? 1}…`}</p> : <a className="btn primary" href="/api/strava/connect">{t("connectStrava")}</a>}
      </div>

      <div className="card">
        <p className="muted">{counts.map((c) => `${c.source}: ${c.n} ${t("activities")}${c.first ? ` ${t("since")} ${c.first}` : ""}`).join(" · ") || t("noRuns")}</p>
        <form action={syncNow}><button className="primary">{t("syncNow")}</button></form>
        <p className="muted">{lang === "he" ? "ייבוא כל ההיסטוריה נעשה בשלבים - לחץ 'סנכרן' כמה פעמים או המתן לסנכרון היומי." : "Full history imports in chunks - tap Sync a few times or let the daily sync finish it."}</p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{lang === "he" ? "פרטיות" : "Privacy"}</h2>
        <p className="muted">{lang === "he"
          ? "נשמרים רק סיכומי ריצות (מרחק, זמן, דופק, הקפות) ונתוני התאוששות. לא נשמרים מסלולי GPS. הטוקנים מוצפנים (AES-256-GCM)."
          : "Only run summaries (distance, time, HR, laps) and recovery data are stored. No GPS tracks. Tokens are encrypted (AES-256-GCM)."}</p>
        <form action={deleteEverything} className="row">
          <input name="confirm" placeholder="DELETE" dir="ltr" style={{ width: 140 }} />
          <button>{lang === "he" ? "מחק את כל הנתונים" : "Delete all data"}</button>
        </form>
      </div>
    </>
  );
}
