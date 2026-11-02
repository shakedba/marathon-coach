import Link from "next/link";
import { syncNow } from "./actions";
import { DayActions } from "@/components/DayActions";
import { Proposals } from "@/components/Proposals";
import { Setup } from "@/components/Setup";
import { WorkoutCard } from "@/components/WorkoutCard";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { ExtraCard } from "@/components/ExtraCard";
import { extrasFor, strengthCaution } from "@/lib/extras";
import * as db from "@/lib/db";
import { dbConfigured, loadWeek } from "@/lib/data";
import { addDays, diffDays, fmtPace, todayLocal, weekday } from "@/lib/dates";
import { DOW, pick, tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { readinessFlag } from "@/lib/metrics";
import { RACES } from "@/lib/plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Today() {
  const lang = await getLang();
  const t = tr(lang);
  if (!dbConfigured()) return <Setup />;
  const today = todayLocal();
  const [{ days, overrides }, proposals, wellness, lastSync, extraStatus, skips] = await Promise.all([
    loadWeek(today, today),
    db.pendingProposals(),
    db.wellnessBetween(today, today),
    db.kvGet<{ at: string; errors: string[] }>("last_sync"),
    db.extraStatusesBetween(today, today),
    db.recentSkips(addDays(today, -3), today),
  ]);
  const extras = extrasFor(today, overrides);
  const caution = strengthCaution(skips, today);
  const day = days.find((d) => d.date === today)!;
  const unanswered = days.filter((d) => d.state === "missed" && !d.status);
  const flag = day.plan.type !== "rest" ? readinessFlag(wellness[0]) : null;
  const race = RACES.find((r) => r.date >= today);

  return (
    <>
      <div className="spread">
        <h1>{t("today")} · {DOW[lang][weekday(today)]} <span className="ltr">{today.split("-").reverse().join("/")}</span></h1>
        {race && <span className="tag">{diffDays(race.date, today)} {t("daysTo")}{pick(lang, race.name)}</span>}
      </div>

      {flag && <div className="banner">{pick(lang, flag)}</div>}
      <Proposals items={proposals} lang={lang} />

      {unanswered.map((d) => (
        <div key={d.date}>
          <h2>{DOW[lang][weekday(d.date)]} <span className="ltr">{d.date.slice(5)}</span> · {pick(lang, d.plan.title)}</h2>
          <DayActions date={d.date} lang={lang} ask />
        </div>
      ))}

      <WorkoutCard w={day.plan} lang={lang} />
      <Link className="day-link" href={`/day/${today}`}>{lang === "he" ? "פרטי היום ‹" : "Day details ›"}</Link>

      {day.activities.map((a) => (
        <div className="card" key={a.id}>
          <div className="spread">
            <b>{a.name}</b>
            <span className={`tag ${day.state}`}>{(a.distanceM / 1000).toFixed(1)} {t("km")}</span>
          </div>
          <div className="muted ltr">
            {fmtPace(a.movingS / (a.distanceM / 1000 || 1))}/km{a.avgHr ? ` · HR ${Math.round(a.avgHr)}` : ""} · {a.source}
          </div>
        </div>
      ))}

      {day.plan.type !== "rest" && !day.status && <DayActions date={today} lang={lang} ran={day.activities.length > 0} />}
      {day.status && (
        <p className="muted">
          {day.status.status === "done" ? t("done") : `${t("skipped")} (${t(`reason_${day.status.reason ?? "time"}` as any)})`}
          {day.status.feel ? ` · ${day.status.feel}/10` : ""}
        </p>
      )}

      {extras.map((x) => (
        <ExtraCard key={x.kind} x={x} lang={lang} status={extraStatus[`${today}:${x.kind}`]} caution={caution} />
      ))}

      <ActionForm action={syncNow} success={t("fb_synced")} error={t("fb_failed")} className="spread" style={{ marginTop: 16 }}>
        <span className="muted">
          {t("lastSync")}: {lastSync ? new Date(lastSync.at).toLocaleString(lang === "he" ? "he-IL" : "en-GB", { timeZone: "Asia/Jerusalem" }) : "—"}
          {lastSync?.errors?.length ? <span style={{ color: "var(--bad)" }}> · {lastSync.errors.join("; ")}</span> : null}
        </span>
        <SubmitButton pendingLabel={t("fb_syncing")}>{t("syncNow")}</SubmitButton>
      </ActionForm>
    </>
  );
}
