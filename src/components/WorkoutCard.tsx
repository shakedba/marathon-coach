import { fmtPace } from "@/lib/dates";
import { pick, tr } from "@/lib/i18n";
import type { Lang, Step, Workout } from "@/lib/types";

const NAMES = { warmup: { en: "Warm-up", he: "חימום" }, cooldown: { en: "Cool-down", he: "שחרור" }, active: { en: "Run", he: "ריצה" }, recovery: { en: "Recovery", he: "התאוששות" } };

function amount(s: Exclude<Step, { kind: "repeat" }>, lang: Lang) {
  const he = lang === "he";
  if (s.distM) return s.distM >= 1000 ? `${s.distM / 1000} ${he ? 'ק"מ' : "km"}` : `${s.distM} ${he ? "מ'" : "m"}`;
  if (s.timeS) return `${Math.round(s.timeS / 60)} ${he ? "דק'" : "min"}`;
  return "";
}

/** One step, localized; numbers stay left-to-right. */
export function StepText({ s, lang }: { s: Step; lang: Lang }): React.ReactNode {
  if (s.kind === "repeat") {
    return (
      <>
        <b className="ltr">{s.times}×</b> ( {s.steps.map((x, i) => <span key={i}>{i > 0 && " + "}<StepText s={x} lang={lang} /></span>)} )
      </>
    );
  }
  return (
    <>
      {NAMES[s.kind][lang]} {amount(s, lang)}
      {s.pace && <> · <span className="ltr">{fmtPace(s.pace[0])}-{fmtPace(s.pace[1])}</span></>}
    </>
  );
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
        {w.hrCap && <span title={lang === "he" ? "חיישן היד לא אמין - בדיקת שפיות בלבד" : "Wrist sensor unreliable - sanity check only"}>· {t("hrCap")} <span className="ltr">{w.hrCap}</span>*</span>}
      </div>
      {w.notes && <div style={{ marginTop: 6 }}>{pick(lang, w.notes)}</div>}
      {!compact && w.steps && w.steps.length > 1 && (
        <ol className="steps">
          {w.steps.map((s, i) => <li key={i}><StepText s={s} lang={lang} /></li>)}
        </ol>
      )}
    </div>
  );
}
