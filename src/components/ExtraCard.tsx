import { markExtra } from "@/app/actions";
import type { Extra } from "@/lib/extras";
import { pick, tr } from "@/lib/i18n";
import type { Lang, Text } from "@/lib/types";

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
        <table>
          <tbody>
            {x.exercises.map((e, i) => (
              <tr key={i}>
                <td>{pick(lang, e.name)}</td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{pick(lang, e.dose)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {x.note && <p className="muted" style={{ marginBottom: 0 }}>{pick(lang, x.note)}</p>}
      </details>
      <form action={markExtra} className="row" style={{ marginTop: 10 }}>
        <input type="hidden" name="date" value={x.date} />
        <input type="hidden" name="kind" value={x.kind} />
        {status ? (
          <button name="status" value="clear">{t("undo")}</button>
        ) : (
          <>
            <button className="primary" name="status" value="done">{t("done")}</button>
            <button name="status" value="skipped">{t("skip")}</button>
          </>
        )}
      </form>
    </div>
  );
}
