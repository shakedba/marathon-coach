import Link from "next/link";
import { EVIDENCE } from "@/lib/evidence";
import { pick } from "@/lib/i18n";
import type { Insight } from "@/lib/insights";
import type { Lang } from "@/lib/types";

const ICON = { warn: "⚠️", good: "✅", info: "💡" } as const;

function Why({ i, lang }: { i: Insight; lang: Lang }) {
  const src = i.source ? EVIDENCE[i.source] : null;
  if (!i.evidence && !src) return null;
  return (
    <details className="why">
      <summary>{lang === "he" ? "למה?" : "Why?"}</summary>
      {i.evidence && <div className="muted ltr" style={{ fontSize: ".8rem" }}>{i.evidence}</div>}
      {src && <a className="src" href={src.url} target="_blank" rel="noopener noreferrer">{src.title} ↗</a>}
    </details>
  );
}

export function InsightItem({ i, lang }: { i: Insight; lang: Lang }) {
  return (
    <li className={`insight ${i.level}`}>
      <span aria-hidden>{ICON[i.level]}</span>
      <div>
        <b>{pick(lang, i.title)}</b>
        <div className="muted">{pick(lang, i.body)}</div>
        {i.action && <Link className="btn" href={i.action.href} style={{ marginTop: 6 }}>{pick(lang, i.action.label)}</Link>}
        <Why i={i} lang={lang} />
      </div>
    </li>
  );
}

/** Home: the single most important insight. */
export function CoachCard({ items, lang }: { items: Insight[]; lang: Lang }) {
  if (!items.length) return null;
  return (
    <section className="card coach">
      <div className="spread">
        <b>🧠 {lang === "he" ? "המאמן" : "Coach"}</b>
        {items.length > 1 && <Link className="day-link" href="/progress#insights" style={{ marginTop: 0 }}>{lang === "he" ? `עוד ${items.length - 1} ›` : `${items.length - 1} more ›`}</Link>}
      </div>
      <ul className="insights"><InsightItem i={items[0]} lang={lang} /></ul>
    </section>
  );
}

/** Progress page: all insights. */
export function InsightsList({ items, lang }: { items: Insight[]; lang: Lang }) {
  return (
    <section className="card" id="insights">
      <h2 style={{ marginTop: 0 }}>🧠 {lang === "he" ? "תובנות המאמן" : "Coach insights"}</h2>
      {items.length ? <ul className="insights">{items.map((i) => <InsightItem key={i.id} i={i} lang={lang} />)}</ul>
        : <p className="muted">{lang === "he" ? "אין עדיין מספיק נתונים לתובנות." : "Not enough data for insights yet."}</p>}
      <p className="muted" style={{ fontSize: ".8rem", marginBottom: 0 }}>
        {lang === "he" ? "כללים קבועים על הנתונים שלך (קצב, מאמץ, מדדי לילה). שינויים בתוכנית רק באישורך." : "Fixed rules over your own data (pace, effort, overnight readings). Plan changes only with your approval."}
      </p>
    </section>
  );
}
