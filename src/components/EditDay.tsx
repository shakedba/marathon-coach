import Link from "next/link";
import { editWorkout, revertDay } from "@/app/actions";
import { weekday } from "@/lib/dates";
import { applyEdit, availableOps, moveTargets, opKey, type EditOp } from "@/lib/edit";
import { DOW, pick, tr } from "@/lib/i18n";
import type { Lang, Workout } from "@/lib/types";
import { ActionForm, SubmitButton } from "./ActionForm";

const short = (w: Workout, lang: Lang) => (w.type === "rest" ? (lang === "he" ? "מנוחה" : "Rest") : `${pick(lang, w.title)}`);

export function EditDay({ week, date, today, lang, op }: {
  week: Workout[]; date: string; today: string; lang: Lang; op: EditOp | null;
}) {
  const t = tr(lang);
  const he = lang === "he";
  const w = week.find((x) => x.date === date)!;
  const ops = availableOps(w);
  const day = (d: string) => <>{DOW[lang][weekday(d)]} <span className="ltr">{d.slice(8)}/{d.slice(5, 7)}</span></>;
  const href = (o: EditOp) => `/day/${date}?edit=${opKey(o)}`;

  if (op) {
    const r = applyEdit(week, date, op, today);
    return (
      <div className="card edit-preview">
        <b>{he ? "תצוגה מקדימה של השינוי" : "Preview of the change"}</b>
        {r.writes.length > 0 && (
          <ul className="changes">
            {r.writes.map(({ w: nw }) => {
              const before = week.find((x) => x.date === nw.date)!;
              return (
                <li key={nw.date}>
                  <span className="muted">{day(nw.date)}:</span> <s className="muted">{short(before, lang)}</s> → <b>{short(nw, lang)}</b>
                </li>
              );
            })}
          </ul>
        )}
        {r.block && <div className="banner bad">⛔ {pick(lang, r.block)}</div>}
        {r.warnings.map((x, i) => <div key={i} className="banner">⚠️ {pick(lang, x)}</div>)}
        {!r.block && r.warnings.length === 0 && <p className="good-text">✓ {he ? "בלי בעיות בטיחות" : "No safety issues"}</p>}
        <div className="row" style={{ marginTop: 10 }}>
          {!r.block && (
            <ActionForm action={editWorkout} success={he ? "השינוי נשמר ונשלח לשעון" : "Saved and sent to the watch"} error={t("fb_failed")} redirectTo={`/day/${date}`}>
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="op" value={opKey(op)} />
              <SubmitButton primary pendingLabel={t("fb_saving")}>{r.warnings.length ? (he ? "לשנות בכל זאת" : "Change anyway") : (he ? "אשר שינוי" : "Confirm")}</SubmitButton>
            </ActionForm>
          )}
          <Link className="btn" href={`/day/${date}`} replace scroll={false}>{he ? "ביטול" : "Cancel"}</Link>
        </div>
      </div>
    );
  }

  const targets = ops.includes("move") ? moveTargets(week, date, today) : [];
  return (
    <details className="card">
      <summary><b>✏️ {he ? "שינוי אימון" : "Change workout"}</b></summary>
      <div className="row" style={{ marginTop: 10 }}>
        {ops.includes("easy") && <Link className="btn" href={href({ kind: "easy" })} scroll={false}>{he ? "להפוך לקלה" : "Make it easy"}</Link>}
        {ops.includes("short") && <Link className="btn" href={href({ kind: "short" })} scroll={false}>{he ? "לקצר ב-25%" : "Shorten 25%"}</Link>}
        {ops.includes("rest") && <Link className="btn" href={href({ kind: "rest" })} scroll={false}>{he ? "מנוחה במקום" : "Rest instead"}</Link>}
      </div>
      {ops.includes("add") && (
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted">{he ? "להוסיף ריצה קלה:" : "Add an easy run:"}</span>
          {[5, 6, 8, 10].map((km) => <Link key={km} className="btn" href={href({ kind: "add", km })} scroll={false}>{km} {t("km")}</Link>)}
        </div>
      )}
      {targets.length > 0 && (
        <div className="row" style={{ marginTop: 10 }}>
          <span className="muted">{he ? "להחליף עם:" : "Swap with:"}</span>
          {targets.map((d) => <Link key={d} className="btn" href={href({ kind: "move", to: d })} scroll={false}>{day(d)}</Link>)}
        </div>
      )}
      <p className="muted" style={{ marginBottom: 0 }}>{he ? "לפני שמירה תראה תצוגה מקדימה ואזהרות בטיחות. אחרי שמירה האימון נשלח מחדש לשעון." : "You'll see a preview and safety warnings before saving. Saved changes are re-sent to the watch."}</p>
    </details>
  );
}

export function RevertDay({ date, lang }: { date: string; lang: Lang }) {
  const he = lang === "he";
  return (
    <ActionForm action={revertDay} success={he ? "חזר לתוכנית המקורית" : "Back to the original plan"} error={tr(lang)("fb_failed")} className="row" style={{ margin: "6px 0" }}>
      <input type="hidden" name="date" value={date} />
      <span className="muted">{he ? "האימון הזה שונה מהתוכנית המקורית." : "This day differs from the original plan."}</span>
      <SubmitButton pendingLabel={tr(lang)("fb_saving")}>↩ {he ? "חזרה לתוכנית" : "Revert to plan"}</SubmitButton>
    </ActionForm>
  );
}
