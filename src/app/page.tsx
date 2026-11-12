import Link from "next/link";
import { EffortChips } from "@/components/EffortChips";
import { CoachCard } from "@/components/Insights";
import { loadInsights } from "@/lib/insights-data";
import { syncProblem } from "@/lib/sync-errors";
import { Proposals } from "@/components/Proposals";
import { Setup } from "@/components/Setup";
import { SkipInline } from "@/components/SkipInline";
import { SwipeNav } from "@/components/SwipeNav";
import { SyncStatus } from "@/components/SyncStatus";
import { WeekStrip } from "@/components/WeekStrip";
import { StepText } from "@/components/WorkoutCard";
import { analyzeRun, mainRun, RPE_SINCE } from "@/lib/analysis";
import * as db from "@/lib/db";
import { dbConfigured, loadWeek } from "@/lib/data";
import { isIsoDate } from "@/lib/dayview";
import { addDays, diffDays, fmtPace, todayLocal, weekday } from "@/lib/dates";
import { extrasFor } from "@/lib/extras";
import { DOW, pick, tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { readinessFlag } from "@/lib/metrics";
import { planFor, RACES } from "@/lib/plan";
import { weekKm } from "@/lib/rebalance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Home: today by default; ?d=YYYY-MM-DD shows another day the same way (swipe or ‹ › to move). */
export default async function Today({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const lang = await getLang();
  const t = tr(lang);
  const he = lang === "he";
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const sel = isIsoDate(d) && Math.abs(diffDays(d, today)) <= 400 ? d : today;
  const isToday = sel === today;
  const past = sel < today;
  const href = (x: string) => (x === today ? "/" : `/?d=${x}`);
  const tomorrowDate = addDays(sel, 1);
  const [{ days, plan: week, overrides }, proposals, wellness, lastSync, extraStatus, pushes, garmin, tomorrowOv] = await Promise.all([
    loadWeek(sel, today),
    db.pendingProposals(),
    db.wellnessBetween(sel, sel),
    db.kvGet<{ at: string; errors: string[] }>("last_sync"),
    db.extraStatusesBetween(sel, sel),
    db.pushesBetween(sel, sel),
    db.kvGet<string>("garmin_tokens"),
    db.overridesBetween(tomorrowDate, tomorrowDate),
  ]);
  // Coach insights are about "now": only on today's view.
  const insights = isToday ? await loadInsights(today).catch((e) => { console.error("insights failed", e); return []; }) : [];
  const day = days.find((x) => x.date === sel)!;
  const plan = day.plan;
  const run = mainRun(day.activities);
  // Ratings before RPE_SINCE were "feel" (direction unclear): same rule as the day page - not used, not asked for.
  const rpeDay = sel >= RPE_SINCE;
  const analysis = run ? analyzeRun(plan, run, rpeDay ? day.status?.feel ?? null : undefined) : null;
  const unanswered = isToday ? days.filter((x) => x.state === "missed" && !x.status) : [];
  const extras = extrasFor(sel, overrides);
  const race = RACES.find((r) => r.date >= today);
  const w = wellness[0];
  const flag = isToday && plan.type !== "rest" && !run ? readinessFlag(w) : null;
  const tomorrow = planFor(tomorrowDate, tomorrowOv);

  // Arrow glyphs are bidi-mirrored characters: in RTL "‹" renders pointing right, which is where "previous" sits.
  return (
    <SwipeNav prev={href(addDays(sel, -1))} next={href(addDays(sel, 1))} rtl={he}>
      <header className="home-head">
        <div className="day-nav">
          <Link className="nav-arrow" href={href(addDays(sel, -1))} aria-label={he ? "היום הקודם" : "Previous day"} scroll={false}>‹</Link>
          <div>
            <h1 style={{ margin: 0 }}>
              {isToday ? `${t("today")} · ` : ""}{DOW[lang][weekday(sel)]} <span className="ltr">{sel.slice(8)}/{sel.slice(5, 7)}</span>
            </h1>
            {isToday
              ? race && <div className="countdown">{diffDays(race.date, today)} {t("daysTo")}{pick(lang, race.name)}</div>
              : <Link className="back-today" href="/" scroll={false}>{he ? "↩ חזרה להיום" : "↩ Back to today"}</Link>}
          </div>
          <Link className="nav-arrow" href={href(addDays(sel, 1))} aria-label={he ? "היום הבא" : "Next day"} scroll={false}>›</Link>
        </div>
        <SyncStatus lastAt={lastSync?.at ?? null} error={lastSync?.errors?.length ? lastSync.errors.join("; ") : undefined} lang={lang} />
      </header>

      {isToday && (() => {
        const p = syncProblem(lastSync?.errors);
        return p ? (
          <div className="banner" role="alert">
            ⚠️ {pick(lang, p.text)}{" "}
            {p.reconnect && <Link href="/settings" style={{ color: "inherit", fontWeight: 700 }}>{he ? "להגדרות ›" : "Settings ›"}</Link>}
          </div>
        ) : null;
      })()}

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
            {day.status?.feel
              ? <p className="muted" style={{ margin: "6px 0 0" }}>{rpeDay ? t("feel") : he ? "תחושה" : "Feel"}: {day.status.feel}/10</p>
              : rpeDay ? <EffortChips date={sel} lang={lang} /> : null}
            <Link className="day-link" href={`/day/${sel}`}>{he ? "ניתוח מלא ›" : "Full analysis ›"}</Link>
          </>
        ) : plan.type === "rest" ? (
          <>
            <b className="hero-title">😌 {t("rest")}</b>
            {plan.notes && <p className="muted" style={{ margin: "6px 0 0" }}>{pick(lang, plan.notes)}</p>}
            <Link className="day-link" href={`/day/${sel}`}>{he ? "פרטים ושינוי ›" : "Details & changes ›"}</Link>
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
              <span className="muted">{past ? "" : garmin ? (pushes[sel] ? (he ? "⌚ בשעון ✓" : "⌚ On your watch ✓") : he ? "⌚ יישלח בסנכרון הבא" : "⌚ Sent at next sync") : ""}</span>
              {day.status?.status === "skipped" ? <span className="tag skipped">{t("skipped")}</span> : sel <= today ? <SkipInline date={sel} lang={lang} /> : null}
            </div>
            {past && !day.status && <p className="cue warn">{he ? "לא נרשמה ריצה ביום הזה." : "No run recorded on this day."}</p>}
            <Link className="day-link" href={`/day/${sel}`}>{he ? "פרטים ושינוי אימון ›" : "Details & change workout ›"}</Link>
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

      <CoachCard items={insights} lang={lang} />

      <WeekStrip days={days} today={today} selected={sel} planned={weekKm(week)} tomorrow={tomorrow} lang={lang} />

      {extras.length > 0 && (
        <div className="extras-row">
          {extras.map((x) => {
            const st = extraStatus[`${sel}:${x.kind}`];
            return (
              <Link key={x.kind} href={`/day/${sel}#extras`} className={`chip ${st ?? ""}`}>
                {x.kind === "strength" ? "💪" : "🧘"} {x.kind === "strength" ? pick(lang, x.title).split(" (")[0] : t("mobility")} · {x.minutes}′ {st === "done" ? "✓" : st === "skipped" ? "✗" : ""}
              </Link>
            );
          })}
        </div>
      )}
      <p className="swipe-hint">↔ {he ? "החלק להחלפת יום" : "Swipe to change day"}</p>
    </SwipeNav>
  );
}
