import Link from "next/link";
import { notFound } from "next/navigation";
import { DayActions } from "@/components/DayActions";
import { EditDay, RevertDay } from "@/components/EditDay";
import { parseOp } from "@/lib/edit";
import { ExtraCard } from "@/components/ExtraCard";
import { Setup } from "@/components/Setup";
import { SwipeNav } from "@/components/SwipeNav";
import { WorkoutCard } from "@/components/WorkoutCard";
import * as db from "@/lib/db";
import { dbConfigured, loadWeek } from "@/lib/data";
import { addDays, fmtDuration, fmtPace, todayLocal, weekday } from "@/lib/dates";
import { isIsoDate, lapVerdict, onPaceShare } from "@/lib/dayview";
import { extrasFor, strengthCaution } from "@/lib/extras";
import { DOW, pick, tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

const fmtDate = (d: string) => d.split("-").reverse().join("/");

export default async function DayPage({ params, searchParams }: { params: Promise<{ date: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { date } = await params;
  const op = parseOp((await searchParams).edit);
  if (!isIsoDate(date)) notFound();
  const lang = await getLang();
  const t = tr(lang);
  const he = lang === "he";
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const [{ days, overrides, plan: week }, wellness, extraStatus, skips] = await Promise.all([
    loadWeek(date, today),
    db.wellnessBetween(date, date),
    db.extraStatusesBetween(date, date),
    db.recentSkips(addDays(date, -3), date),
  ]);
  const day = days.find((d) => d.date === date)!;
  const plan = day.plan;
  const extras = extrasFor(date, overrides);
  const caution = date >= today ? strengthCaution(skips, date) : null;
  const w = wellness[0];
  const prev = `/day/${addDays(date, -1)}`;
  const next = `/day/${addDays(date, 1)}`;
  const canEdit = date >= today && plan.type !== "race" && day.activities.length === 0;
  const overridden = !!overrides[date];
  const canAnswer = plan.type !== "rest" && !day.status && date <= today;

  return (
    <SwipeNav prev={prev} next={next} rtl={he}>
      <Link href={`/week?w=${date}`} className="back">{he ? "› " : "‹ "}{t("plan")}</Link>
      <div className="spread">
        <Link className="btn" href={prev} aria-label={he ? "היום הקודם" : "Previous day"}>‹</Link>
        <h1 style={{ margin: 0, textAlign: "center" }}>
          {DOW[lang][weekday(date)]} <span className="ltr">{fmtDate(date)}</span>
          {date === today && <span className="tag" style={{ marginInlineStart: 8 }}>{t("state_today")}</span>}
        </h1>
        <Link className="btn" href={next} aria-label={he ? "היום הבא" : "Next day"}>›</Link>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        <span className={`tag ${day.state}`}>{t(`state_${day.state}`)}</span>
        {plan.type !== "rest" && <> · {t("planned")} {plan.km} {t("km")}{day.actualKm > 0 && <> · {t("actual")} <span className="ltr">{day.actualKm}</span> {t("km")}</>}</>}
      </p>

      <WorkoutCard w={plan} lang={lang} />
      {overridden && date >= today && !op && <RevertDay date={date} lang={lang} />}
      {canEdit && <EditDay week={week} date={date} today={today} lang={lang} op={op} />}

      {day.activities.map((a) => {
        const km = a.distanceM / 1000;
        const laps = a.laps ?? [];
        const share = onPaceShare(laps, plan.type, plan.pace);
        return (
          <div className="card" key={a.id}>
            <div className="spread">
              <b>{a.name}</b>
              <span className="tag">{a.source === "garmin" ? "Garmin" : "Strava"}</span>
            </div>
            <div className="stats ltr">
              <div><b>{km.toFixed(2)}</b><span>km</span></div>
              <div><b>{fmtDuration(a.movingS)}</b><span>{he ? "זמן" : "time"}</span></div>
              <div><b>{fmtPace(a.movingS / (km || 1))}</b><span>/km</span></div>
              {a.avgHr ? <div><b>{Math.round(a.avgHr)}</b><span>{he ? "דופק ממוצע" : "avg HR"}</span></div> : null}
              {a.maxHr ? <div><b>{Math.round(a.maxHr)}</b><span>{he ? "דופק מקס'" : "max HR"}</span></div> : null}
              {a.elevGain ? <div><b>{Math.round(a.elevGain)}</b><span>{he ? "מ' טיפוס" : "m climb"}</span></div> : null}
            </div>
            {plan.hrCap && a.avgHr ? (
              <p className={a.avgHr > plan.hrCap ? "warn-text" : "good-text"} style={{ margin: "6px 0 0" }}>
                {a.avgHr > plan.hrCap
                  ? (he ? `דופק ממוצע מעל התקרה (${plan.hrCap})` : `Average HR above the cap (${plan.hrCap})`)
                  : (he ? `דופק ממוצע מתחת לתקרה (${plan.hrCap}) ✓` : `Average HR under the cap (${plan.hrCap}) ✓`)}
              </p>
            ) : null}
            {share !== null && (
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {he ? `${share}% מהמרחק בטווח הקצב המתוכנן` : `${share}% of the distance in the planned pace range`}
              </p>
            )}
            {laps.length > 1 && (
              <details style={{ marginTop: 8 }} open={laps.length <= 30}>
                <summary className="muted">{laps.length} {he ? "הקפות" : "laps"}</summary>
                <table className="laps ltr">
                  <thead><tr><th>#</th><th>km</th><th>{he ? "זמן" : "time"}</th><th>/km</th><th>HR</th></tr></thead>
                  <tbody>
                    {laps.map((l, i) => {
                      const v = lapVerdict(l, plan.type, plan.pace);
                      return (
                        <tr key={i}>
                          <td className="muted">{i + 1}</td>
                          <td>{(l.distanceM / 1000).toFixed(2)}</td>
                          <td>{fmtDuration(l.durationS)}</td>
                          <td className={v ? `lap-${v}` : undefined}>{l.distanceM > 0 ? fmtPace(l.durationS / (l.distanceM / 1000)) : "—"}{v === "fast" ? " ↑" : v === "slow" ? " ↓" : ""}</td>
                          <td className={plan.hrCap && l.avgHr && l.avgHr > plan.hrCap ? "lap-slow" : undefined}>{l.avgHr ? Math.round(l.avgHr) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {plan.pace && <p className="muted" style={{ margin: "4px 0 0" }}>{he ? "↑ מהיר מהטווח · ↓ איטי מהטווח" : "↑ faster than range · ↓ slower than range"}</p>}
              </details>
            )}
          </div>
        );
      })}

      {day.status && (
        <div className="card">
          <b>{day.status.status === "done" ? `✓ ${t("done")}` : `✗ ${t("skipped")} · ${t(`reason_${day.status.reason ?? "time"}` as "reason_time")}`}</b>
          {day.status.feel ? <span className="muted"> · {t("feel")}: {day.status.feel}/10</span> : null}
          {day.status.note && <p style={{ margin: "6px 0 0" }}>{day.status.note}</p>}
        </div>
      )}
      {canAnswer && <DayActions date={date} lang={lang} ask={date < today && day.activities.length === 0} ran={day.activities.length > 0} />}

      {extras.map((x) => (
        <ExtraCard key={x.kind} x={x} lang={lang} status={extraStatus[`${date}:${x.kind}`]} caution={caution} />
      ))}

      {w && (w.sleepScore || w.hrvAvg || w.restingHr || w.bodyBatteryHigh) ? (
        <div className="card">
          <b>{t("recovery")}</b>
          <div className="stats ltr" style={{ marginTop: 6 }}>
            {w.sleepScore ? <div><b>{w.sleepScore}</b><span>{he ? "שינה" : "sleep"}</span></div> : null}
            {w.hrvAvg ? <div><b>{Math.round(w.hrvAvg)}</b><span>HRV{w.hrvStatus ? ` · ${w.hrvStatus.toLowerCase()}` : ""}</span></div> : null}
            {w.restingHr ? <div><b>{w.restingHr}</b><span>{he ? "דופק מנוחה" : "resting HR"}</span></div> : null}
            {w.bodyBatteryHigh ? <div><b>{w.bodyBatteryHigh}</b><span>Body Battery</span></div> : null}
          </div>
        </div>
      ) : null}
      <p className="swipe-hint">↔ {he ? "החלק להחלפת יום" : "Swipe to change day"}</p>
    </SwipeNav>
  );
}
