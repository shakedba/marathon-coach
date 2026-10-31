import { MpHrChart, VolumeChart } from "@/components/Charts";
import { Setup } from "@/components/Setup";
import * as db from "@/lib/db";
import { dbConfigured } from "@/lib/data";
import { addDays, fmtDuration, fmtPace, todayLocal } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { mpEfficiency, predictMarathon, weeklyVolume } from "@/lib/metrics";

export const dynamic = "force-dynamic";
const PLAN_START = "2026-07-20";

export default async function ProgressPage() {
  const lang = await getLang();
  const t = tr(lang);
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const [acts, overrides, well] = await Promise.all([
    db.activitiesBetween(addDays(PLAN_START, -14), today),
    db.overridesBetween(PLAN_START, addDays(today, 30)),
    db.wellnessBetween(addDays(today, -13), today),
  ]);
  const vol = weeklyVolume(PLAN_START, today, acts, overrides);
  const mp = mpEfficiency(acts);
  const pred = predictMarathon(acts, today);
  return (
    <>
      <h1>{t("progress")}</h1>
      {pred && (
        <div className="card">
          <div className="muted">{t("prediction")} (Riegel)</div>
          <div className="big ltr">{fmtDuration(pred.marathon)} · {fmtPace(pred.marathon / 42.195)}/km</div>
          <div className="muted ltr">{pred.label} {pred.date} · {fmtDuration(pred.seconds)}</div>
        </div>
      )}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t("volume")}</h2>
        <VolumeChart data={vol} labels={{ planned: t("planned"), actual: t("actual") }} />
        <details><summary className="muted">{t("table")}</summary>
          <table className="ltr"><tbody>{vol.map((v) => <tr key={v.week}><td>{v.week}</td><td>{v.actual}</td><td>{v.planned}</td></tr>)}</tbody></table>
        </details>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t("mpHr")}</h2>
        <MpHrChart pts={mp} />
        <p className="muted">{lang === "he" ? "דופק נמוך יותר באותו קצב = כושר טוב יותר." : "Lower HR at the same pace = fitter."}</p>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t("recovery")}</h2>
        {!well.length ? <p className="muted">—</p> : (
          <table className="ltr">
            <thead><tr><th>date</th><th>HRV</th><th>sleep</th><th>BB</th><th>ready</th><th>RHR</th></tr></thead>
            <tbody>{well.slice().reverse().map((w) => (
              <tr key={w.date}><td>{w.date.slice(5)}</td><td>{w.hrvAvg ?? ""} {w.hrvStatus ? <span className="muted">{w.hrvStatus.toLowerCase()}</span> : ""}</td><td>{w.sleepScore ?? ""}</td><td>{w.bodyBatteryHigh ?? ""}</td><td>{w.readiness ?? ""}</td><td>{w.restingHr ?? ""}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
