import { Setup } from "@/components/Setup";
import * as db from "@/lib/db";
import { dbConfigured } from "@/lib/data";
import { addDays, fmtDuration, fmtPace, todayLocal } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const lang = await getLang();
  const t = tr(lang);
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const [acts, counts] = await Promise.all([db.activitiesBetween(addDays(today, -90), today), db.activityCount()]);
  const runs = acts.filter((a) => /run/i.test(a.sport)).reverse();
  return (
    <>
      <h1>{t("log")}</h1>
      <p className="muted">
        {t("history")}: {counts.map((c) => `${c.source} ${c.n} ${t("activities")}${c.first ? ` ${t("since")} ${c.first}` : ""}`).join(" · ") || t("noRuns")}
      </p>
      {!runs.length && <div className="card">{t("noRuns")}</div>}
      {runs.map((a) => (
        <div className="card" key={a.id}>
          <div className="spread">
            <b>{a.name}</b>
            <span className="tag ltr">{a.date.split("-").reverse().join("/")}</span>
          </div>
          <div className="row ltr" style={{ marginTop: 4 }}>
            <span><b>{(a.distanceM / 1000).toFixed(2)}</b> km</span>
            <span>{fmtDuration(a.movingS)}</span>
            <span>{fmtPace(a.movingS / (a.distanceM / 1000 || 1))}/km</span>
            {a.avgHr ? <span>HR {Math.round(a.avgHr)}{a.maxHr ? `/${Math.round(a.maxHr)}` : ""}</span> : null}
            {a.isRace && <span className="tag">race</span>}
            <span className="muted">{a.source}</span>
          </div>
          {a.laps && a.laps.length > 1 && (
            <details style={{ marginTop: 6 }}>
              <summary className="muted">laps ({a.laps.length})</summary>
              <table className="ltr">
                <tbody>
                  {a.laps.map((l, i) => (
                    <tr key={i}><td>{i + 1}</td><td>{(l.distanceM / 1000).toFixed(2)}</td><td>{fmtPace(l.durationS / (l.distanceM / 1000 || 1))}</td><td>{l.avgHr ? Math.round(l.avgHr) : ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      ))}
    </>
  );
}
