import { markExtra } from "@/app/actions";
import type { Extra } from "@/lib/extras";
import { pick, tr } from "@/lib/i18n";
import type { Lang, Text } from "@/lib/types";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ExerciseHowTo } from "./ExerciseHowTo";

export function ExtraCard({ x, lang, status, caution }: { x: Extra; lang: Lang; status?: "done" | "skipped"; caution?: Text | null }) {
  const t = tr(lang);
  return (
    <div className="card">
      <div className="spread">
        <b>{x.kind === "strength" ? "💪 " : "🧘 "}{pick(lang, x.title)}</b>
        <span className={`tag ${status ?? ""}`}>
          {status ? t(status === "done" ? "done" : "skipped") : `${x.minutes} ${t("min")}`}
        </span>
      </div>
      {caution && x.kind === "strength" && <div className="banner">{pick(lang, caution)}</div>}
      <details open={!status && x.kind === "strength"} style={{ marginTop: 6 }}>
        <summary className="muted">
          {x.exercises.length} {lang === "he" ? "תרגילים" : "exercises"}
          {x.rounds > 1 ? ` · ${x.rounds} ${t("rounds")}` : ""}
        </summary>
        <div className="exlist">
          {x.exercises.map((e, i) => (
            <details key={i} className="ex">
              <summary>
                <span>{pick(lang, e.name)}</span>
                <span className="muted" style={{ whiteSpace: "nowrap" }}>{pick(lang, e.dose)}</span>
              </summary>
              <ExerciseHowTo id={e.id} lang={lang} uid={`${x.date}-${x.kind}-${i}`} />
            </details>
          ))}
        </div>
        <p className="muted" style={{ fontSize: ".82rem", margin: "4px 0 0" }}>{lang === "he" ? "הקש על תרגיל לאיור והסבר" : "Tap an exercise for a drawing and how-to"}</p>
        {x.note && <p className="muted" style={{ marginBottom: 0 }}>{pick(lang, x.note)}</p>}
      </details>
      <ActionForm action={markExtra} success={{ done: t("fb_done"), skipped: t("fb_saved"), clear: t("fb_cleared") }} error={t("fb_failed")} className="row" style={{ marginTop: 10 }}>
        <input type="hidden" name="date" value={x.date} />
        <input type="hidden" name="kind" value={x.kind} />
        {status ? (
          <SubmitButton name="status" value="clear">{t("undo")}</SubmitButton>
        ) : (
          <>
            <SubmitButton primary name="status" value="done">{t("done")}</SubmitButton>
            <SubmitButton name="status" value="skipped">{t("skip")}</SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}
