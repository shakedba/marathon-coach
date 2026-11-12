import { SyncStatus } from "@/components/SyncStatus";
import Link from "next/link";
import { DayActions } from "@/components/DayActions";
import { Proposals } from "@/components/Proposals";
import { Setup } from "@/components/Setup";
import * as db from "@/lib/db";
import { dbConfigured, loadWeek } from "@/lib/data";
import { addDays, fmtPace, todayLocal, weekday, weekStart } from "@/lib/dates";
import { DOW, pick, tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { weekKm } from "@/lib/rebalance";
import { extrasWeek } from "@/lib/extras";
import { SwipeNav } from "@/components/SwipeNav";

export const dynamic = "force-dynamic";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const lang = await getLang();
  const t = tr(lang);
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const { w } = await searchParams;
  const ws = weekStart(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : today);
  const [{ days, plan, overrides }, proposals, extraStatus, lastSync] = await Promise.all([
    loadWeek(ws, today), db.pendingProposals(), db.extraStatusesBetween(ws, addDays(ws, 6)),
    db.kvGet<{ at: string; errors: string[] }>("last_sync"),
  ]);
  const extras = extrasWeek(ws, overrides);
  const actual = Math.round(days.reduce((s, d) => s + d.actualKm, 0) * 10) / 10;

  return (
    <>
      <SwipeNav prev={`/week?w=${addDays(ws, -7)}`} next={`/week?w=${addDays(ws, 7)}`} rtl={lang === "he"}>
      <div className="spread">
        <Link className="btn" href={`/week?w=${addDays(ws, -7)}`}>‹</Link>
        <h1 className="ltr" style={{ margin: 0 }}>{ws.split("-").reverse().join("/")}</h1>
        <Link className="btn" href={`/week?w=${addDays(ws, 7)}`}>›</Link>
      </div>
      <div className="spread" style={{ marginBlock: 8 }}>
        <p className="muted" style={{ margin: 0 }}>{t("planned")}: {weekKm(plan)} {t("km")} · {t("actual")}: {actual} {t("km")}</p>
        <SyncStatus lastAt={lastSync?.at ?? null} error={lastSync?.errors?.length ? lastSync.errors.join("; ") : undefined} lang={lang} />
      </div>
      <Proposals items={proposals.filter((p) => p.proposal.weekStart === ws)} lang={lang} />
      <div className="card">
        <table>
          <thead><tr><th></th><th>{t("planned")}</th><th>{t("actual")}</th><th></th></tr></thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} style={d.date === today ? { background: "var(--soft)" } : undefined}>
                <td><Link className="dayrow" href={`/day/${d.date}`}>{DOW[lang][weekday(d.date)]}<div className="muted ltr">{d.date.slice(8)}/{d.date.slice(5, 7)}</div></Link></td>
                <td>
                  <Link className="dayrow" href={`/day/${d.date}`}>{d.plan.type === "rest" ? <span className="muted">{t("rest")}</span> : <u style={{ textDecorationColor: "var(--line)" }}>{pick(lang, d.plan.title)}</u>}</Link>
                  {d.plan.pace && <div className="muted ltr">{fmtPace(d.plan.pace[0])}-{fmtPace(d.plan.pace[1])}{d.plan.hrCap ? ` · HR≤${d.plan.hrCap}` : ""}</div>}
                  {extras[d.date].length > 0 && (
                    <div className="muted">
                      {extras[d.date].map((x) => {
                        const st = extraStatus[`${d.date}:${x.kind}`];
                        return <span key={x.kind} style={{ marginInlineEnd: 8 }}>{x.kind === "strength" ? "💪" : "🧘"} {x.kind === "strength" ? pick(lang, x.title) : t("mobility")}{st === "done" ? " ✓" : st === "skipped" ? " ✗" : ""}</span>;
                      })}
                    </div>
                  )}
                </td>
                <td className="ltr">
                  {d.actualKm > 0 ? `${d.actualKm} km` : ""}
                  {d.activities[0] && <div className="muted">{fmtPace(d.activities.reduce((s, a) => s + a.movingS, 0) / d.actualKm)}{d.activities[0].avgHr ? ` · ${Math.round(d.activities[0].avgHr)}` : ""}</div>}
                </td>
                <td><span className={`tag ${d.state}`}>{t(`state_${d.state}`)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {days.filter((d) => d.state === "missed" && !d.status).map((d) => (
        <div key={d.date}>
          <h2>{DOW[lang][weekday(d.date)]} · {pick(lang, d.plan.title)}</h2>
          <DayActions date={d.date} lang={lang} ask />
        </div>
      ))}
      <p className="swipe-hint">↔ {t("fb_swipe")} · {lang === "he" ? "הקש על יום לפרטים" : "Tap a day for details"}</p>
      </SwipeNav>
    </>
  );
}
