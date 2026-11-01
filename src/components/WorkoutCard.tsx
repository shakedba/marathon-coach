import { fmtPace } from "@/lib/dates";
import { pick, tr } from "@/lib/i18n";
import type { Lang, Step, Workout } from "@/lib/types";

function stepText(s: Step, lang: Lang): string {
  if (s.kind === "repeat") return `${s.times}× ( ${s.steps.map((x) => stepText(x, lang)).join(" + ")} )`;
  const names = { warmup: { en: "warm-up", he: "חימום" }, cooldown: { en: "cool-down", he: "שחרור" }, active: { en: "run", he: "ריצה" }, recovery: { en: "recovery", he: "התאוששות" } };
  const dist = s.distM ? (s.distM >= 1000 ? `${s.distM / 1000} km` : `${s.distM} m`) : s.timeS ? `${Math.round(s.timeS / 60)} min` : "";
  const pace = s.pace ? ` @ ${fmtPace(s.pace[0])}-${fmtPace(s.pace[1])}` : "";
  const hr = s.hrMax ? ` (HR ≤ ${s.hrMax})` : "";
  return `${names[s.kind][lang]} ${dist}${pace}${hr}`;
}

export function WorkoutCard({ w, lang, compact = false }: { w: Workout; lang: Lang; compact?: boolean }) {
  const t = tr(lang);
  if (w.type === "rest") {
    return (
      <div className="card">
        <div className="big">{t("rest")}</div>
        {w.notes && <div className="muted">{pick(lang, w.notes)}</div>}
      </div>
    );
  }
  return (
    <div className="card">
      <div className="spread">
        <div className="big">{pick(lang, w.title)}</div>
        <span className="tag">{w.km} {t("km")}</span>
      </div>
      <div className="row muted" style={{ marginTop: 6 }}>
        {w.pace && <span>{t("pace")}: <b className="ltr">{fmtPace(w.pace[0])}-{fmtPace(w.pace[1])}</b></span>}
        {w.hrCap && <span>· {t("hrCap")}: <b className="ltr">{w.hrCap}</b></span>}
      </div>
      {w.notes && <div style={{ marginTop: 6 }}>{pick(lang, w.notes)}</div>}
      {!compact && w.steps && w.steps.length > 1 && (
        <ol className="steps ltr" style={{ display: "block" }}>
          {w.steps.map((s, i) => <li key={i}>{stepText(s, "en")}</li>)}
        </ol>
      )}
    </div>
  );
}
