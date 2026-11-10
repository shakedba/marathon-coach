import Link from "next/link";
import { rateEffort } from "@/app/actions";
import type { Analysis, Finding } from "@/lib/analysis";
import { fmtPace } from "@/lib/dates";
import { EVIDENCE } from "@/lib/evidence";
import { pick, tr } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { ActionForm, SubmitButton } from "./ActionForm";
import { EffortSelect } from "./EffortSelect";

const ICON = { good: "✅", info: "ℹ️", warn: "⚠️" } as const;
const order = (f: Finding) => (f.level === "warn" ? 0 : f.level === "good" ? 1 : 2);

function FindingRow({ f, lang }: { f: Finding; lang: Lang }) {
  const src = f.source ? EVIDENCE[f.source] : null;
  return (
    <li className={`finding ${f.level}`}>
      <span aria-hidden>{ICON[f.level]}</span>
      <div>
        {pick(lang, f.text)}
        {f.evidence && <div className="muted ltr" style={{ fontSize: ".8rem" }}>{f.evidence}</div>}
        {src && <a className="src" href={src.url} target="_blank" rel="noopener noreferrer" title={src.title}>{lang === "he" ? "מקור" : "Source"} ↗</a>}
      </div>
    </li>
  );
}

export function AnalysisCard({ a, lang, date, rpeMissing, compact }: { a: Analysis; lang: Lang; date: string; rpeMissing?: boolean; compact?: boolean }) {
  const he = lang === "he";
  const t = tr(lang);
  const findings = [...a.findings].sort((x, y) => order(x) - order(y));
  const head = a.headline === "warn" ? (he ? "יש מה לשפר" : "Something to adjust") : a.headline === "good" ? (he ? "אימון טוב" : "Good session") : he ? "ניתוח" : "Analysis";
  if (compact) {
    return (
      <Link href={`/day/${date}`} className="card dayrow">
        <b>{ICON[a.headline]} {he ? "ניתוח האימון" : "Run analysis"}: {head}</b>
        <ul className="findings">{findings.filter((f) => f.level !== "info").slice(0, 2).map((f, i) => <li key={i} className={`finding ${f.level}`}><span aria-hidden>{ICON[f.level]}</span><div>{pick(lang, f.text)}</div></li>)}</ul>
        <span className="day-link">{he ? "לניתוח המלא ‹" : "Full analysis ›"}</span>
      </Link>
    );
  }
  return (
    <div className="card">
      <b>{ICON[a.headline]} {he ? "ניתוח האימון" : "Run analysis"}: {head}</b>
      <table className="ltr segs">
        <thead><tr><th>{he ? "קטע" : "Part"}</th><th>km</th><th>{he ? "יעד" : "Target"}</th><th>{he ? "בפועל" : "Actual"}</th><th></th></tr></thead>
        <tbody>
          {a.segments.map((s, i) => {
            const v = s.role === "easy" && s.fastShare >= 0.25 ? "fast" : s.verdict;
            return (
            <tr key={i}>
              <td>{pick(lang, s.label)}</td>
              <td>{s.km}</td>
              <td className="muted">{s.planned ? `${fmtPace(s.planned[0])}-${fmtPace(s.planned[1])}` : "—"}</td>
              <td className={v === "ok" ? "lap-ok" : v === "fast" ? "lap-fast" : v === "slow" ? "lap-slow" : undefined}>{s.pace ? fmtPace(s.pace) : "—"}</td>
              <td>{v === "ok" ? "✓" : v === "fast" ? "↑" : v === "slow" ? "↓" : ""}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="findings">{findings.map((f, i) => <FindingRow key={i} f={f} lang={lang} />)}</ul>
      {rpeMissing && (
        <ActionForm action={rateEffort} success={he ? "המאמץ נשמר" : "Effort saved"} error={t("fb_failed")} className="row">
          <input type="hidden" name="date" value={date} />
          <EffortSelect lang={lang} required />
          <SubmitButton primary pendingLabel={t("fb_saving")}>{t("save")}</SubmitButton>
        </ActionForm>
      )}
      <p className="muted" style={{ margin: "8px 0 0", fontSize: ".8rem" }}>
        {he ? "מבוסס על קצב (GPS) ומאמץ. דופק מהשעון משמש רק כשהוא עובר בדיקת אמינות." : "Based on pace (GPS) and effort. Watch HR is only used when it passes a plausibility check."}
      </p>
    </div>
  );
}
