import Link from "next/link";
import { weekday } from "@/lib/dates";
import { DOW, pick, tr } from "@/lib/i18n";
import type { DayMatch } from "@/lib/rebalance";
import type { Lang, Workout } from "@/lib/types";

const ICON: Record<string, string> = { done: "✓", moved: "✓", partial: "◐", missed: "✗", skipped: "✗", extra: "+", rest: "", today: "●", future: "" };

export function WeekStrip({ days, today, selected, planned, tomorrow, lang }: { days: DayMatch[]; today: string; selected: string; planned: number; tomorrow: Workout; lang: Lang }) {
  const t = tr(lang);
  const actual = Math.round(days.reduce((s, d) => s + d.actualKm, 0) * 10) / 10;
  const pct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
  return (
    <div className="card">
      <div className="week-dots">
        {days.map((d) => (
          <Link key={d.date} href={d.date === today ? "/" : `/?d=${d.date}`} scroll={false} aria-current={d.date === selected ? "date" : undefined}
            className={`wd ${d.state} ${d.date === today ? "is-today" : ""} ${d.date === selected ? "is-sel" : ""} ${d.plan.type === "rest" ? "is-rest" : ""}`}
            aria-label={`${DOW[lang][weekday(d.date)]} ${d.date.slice(8)}/${d.date.slice(5, 7)}: ${t(`state_${d.state}`)}`}>
            <span className="wd-day">{DOW[lang][weekday(d.date)]}</span>
            <span className="wd-mark">{ICON[d.state] ?? ""}</span>
            <span className="wd-km">{d.plan.type === "rest" ? "–" : d.plan.type === "race" ? "🏁" : d.plan.km}</span>
          </Link>
        ))}
      </div>
      <div className="km-bar" aria-label={`${actual}/${planned} ${t("km")}`}><span style={{ width: `${pct}%` }} /></div>
      <div className="spread muted" style={{ marginTop: 6 }}>
        <span>{selected === today ? (lang === "he" ? "מחר" : "Tomorrow") : lang === "he" ? "יום אחרי" : "Next day"}: <b style={{ color: "var(--ink)" }}>{tomorrow.type === "rest" ? t("rest") : pick(lang, tomorrow.title)}</b></span>
        <span className="ltr">{actual}/{planned} {lang === "he" ? 'ק"מ' : "km"}</span>
      </div>
    </div>
  );
}
