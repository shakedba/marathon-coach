import Link from "next/link";
import { EffortChips } from "@/components/EffortChips";
import { Proposals } from "@/components/Proposals";
import { Setup } from "@/components/Setup";
import { SkipInline } from "@/components/SkipInline";
import { SyncStatus } from "@/components/SyncStatus";
import { WeekStrip } from "@/components/WeekStrip";
import { StepText } from "@/components/WorkoutCard";
import { analyzeRun, mainRun } from "@/lib/analysis";
import * as db from "@/lib/db";
import { dbConfigured, loadWeek } from "@/lib/data";
import { addDays, diffDays, fmtPace, todayLocal, weekday } from "@/lib/dates";
import { extrasFor } from "@/lib/extras";
import { DOW, pick, tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { readinessFlag } from "@/lib/metrics";
import { planFor, RACES } from "@/lib/plan";
import { weekKm } from "@/lib/rebalance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Today() {
  const lang = await getLang();
  const t = tr(lang);
  const he = lang === "he";
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const tomorrowDate = addDays(today, 1);
  const [{ days, plan: week, overrides }, proposals, wellness, lastSync, extraStatus, pushes, garmin, tomorrowOv] = await Promise.all([
    loadWeek(today, today),
    db.pendingProposals(),
    db.wellnessBetween(today, today),
    db.kvGet<{ at: string; errors: string[] }>("last_sync"),
    db.extraStatusesBetween(today, today),
    db.pushesBetween(today, today),
    db.kvGet<string>("garmin_tokens"),
    db.overridesBetween(tomorrowDate, tomorrowDate),
  ]);
  const day = days.find((d) => d.date === today)!;
  const plan = day.plan;
  const run = mainRun(day.activities);
  const analysis = run ? analyzeRun(plan, run, day.status?.feel ?? null) : null;
  const unanswered = days.filter((d) => d.state === "missed" && !d.status);
  const extras = extrasFor(today, overrides);
  const race = RACES.find((r) => r.date >= today);
  const w = wellness[0];
  const flag = plan.type !== "rest" && !run ? readinessFlag(w) : null;
  const tomorrow = planFor(tomorrowDate, tomorrowOv);

  return (
    <>
      <header className="home-head">
        <div>
          <h1 style={{ margin: 0 }}>{DOW[lang][weekday(today)]} <span className="ltr">{today.slice(8)}/{today.slice(5, 7)}</span></h1>
          {race && <div className="countdown">{diffDays(race.date, today)} {t("daysTo")}{pick(lang, race.name)}</div>}
        </div>
        <SyncStatus lastAt={lastSync?.at ?? null} error={lastSync?.errors?.length ? lastSync.errors.join("; ") : undefined} lang={lang} />
      </header>

      {/* Things that need an answer come first, as one line each */}
      <Proposals items={proposals} lang={lang} />
      {unanswered.map((d) => (
        <Link key={d.date} href={`/day/${d.date}`} className="alert-row">
          ❓ {DOW[lang][weekday(d.date)]} · {pick(lang, d.plan.title)} - {he ? "מה קרה?" : "what happened?"} ›
        </Link>
      ))}

      {/* The one card that matters today */}
      <section className={`card hero ${run ? "after" : plan.type === "rest" ? "rest" : "before"}`}>
        {run && analysis ? (
          <>
            <div className="spread">
              <b className="hero-title">{analysis.headline === "warn" ? "⚠️" : "✅"} {plan.type === "rest" ? (he ? "ריצה נוספת" : "Extra run") : pick(lang, plan.title)}</b>
              <span className="tag done ltr">{(run.distanceM / 1000).toFixed(1)} km · {fmtPace(run.movingS / (run.distanceM / 1000 || 1))}</span>
            </div>
            <ul className="findings">
              {analysis.findings.filter((f) => f.level !== "info").slice(0, 2).map((f, i) => (
                <li key={i} className={`finding ${f.level}`}><span aria-hidden>{f.level === "warn" ? "⚠️" : "✅"}</span><div>{pick(lang, f.text)}</div></li>
              ))}
            </ul>
            {!day.status?.feel ? <EffortChips date={today} lang={lang} /> : <p className="muted" style={{ margin: "6px 0 0" }}>{t("feel")}: {day.status.feel}/10</p>}
            <Link className="day-link" href={`/day/${today}`}>{he ? "ניתוח מלא ›" : "Full analysis ›"}</Link>
          </>
        ) : plan.type === "rest" ? (
          <>
            <b className="hero-title">😌 {t("rest")}</b>
            {plan.notes && <p className="muted" style={{ margin: "6px 0 0" }}>{pick(lang, plan.notes)}</p>}
          </>
        ) : (
          <>
            <div className="spread">
              <b className="hero-title">{pick(lang, plan.title)}</b>
              <span className="tag">{plan.km} {t("km")}</span>
            </div>
            {plan.steps && plan.steps.length > 1 ? (
              <ol className="steps compact">{plan.steps.map((s, i) => <li key={i}><StepText s={s} lang={lang} /></li>)}</ol>
            ) : plan.pace ? (
              <p className="hero-target">{t("pace")} <b className="ltr">{fmtPace(plan.pace[0])}-{fmtPace(plan.pace[1])}</b></p>
            ) : null}
            {plan.notes && <p className="cue">💬 {pick(lang, plan.notes)}</p>}
            {flag && <p className="cue warn">⚠️ {pick(lang, flag)}</p>}
            <div className="spread" style={{ marginTop: 8 }}>
              <span className="muted">{garmin ? (pushes[today] ? (he ? "⌚ בשעון ✓" : "⌚ On your watch ✓") : he ? "⌚ יישלח בסנכרון הבא" : "⌚ Sent at next sync") : ""}</span>
              {day.status?.status === "skipped" ? <span className="tag skipped">{t("skipped")}</span> : <SkipInline date={today} lang={lang} />}
            </div>
          </>
        )}
        {w && (w.sleepScore || w.hrvStatus || w.restingHr) ? (
          <div className="readiness">
            {w.sleepScore ? <span>😴 {w.sleepScore}</span> : null}
            {w.hrvStatus ? <span>HRV {w.hrvStatus.toLowerCase()}</span> : null}
            {w.restingHr ? <span>♥ {w.restingHr}</span> : null}
          </div>
        ) : null}
      </section>

      <WeekStrip days={days} today={today} planned={weekKm(week)} tomorrow={tomorrow} lang={lang} />

      {extras.length > 0 && (
        <div className="extras-row">
          {extras.map((x) => {
            const st = extraStatus[`${today}:${x.kind}`];
            return (
              <Link key={x.kind} href={`/day/${today}#extras`} className={`chip ${st ?? ""}`}>
                {x.kind === "strength" ? "💪" : "🧘"} {x.kind === "strength" ? pick(lang, x.title).split(" (")[0] : t("mobility")} · {x.minutes}′ {st === "done" ? "✓" : st === "skipped" ? "✗" : ""}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
