import { markDone, markSkipped } from "@/app/actions";
import { tr } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function DayActions({ date, lang, ask, ran }: { date: string; lang: Lang; ask?: boolean; ran?: boolean }) {
  const t = tr(lang);
  return (
    <div className="card">
      {ask && <p style={{ marginTop: 0 }}>{t("missedAsk")}</p>}
      <form action={markDone} className="row">
        <input type="hidden" name="date" value={date} />
        <select name="feel" style={{ width: 130 }} defaultValue="" aria-label={t("feel")}>
          <option value="">{t("feel")}</option>
          {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <button className="primary">{t("done")}</button>
      </form>
      {!ran && <form action={markSkipped} className="row" style={{ marginTop: 10 }}>
        <input type="hidden" name="date" value={date} />
        <span className="muted">{t("skipped")} – {t("why")}</span>
        {(["time", "tired", "ill", "fever", "niggle"] as const).map((r) => (
          <button key={r} name="reason" value={r}>{t(`reason_${r}`)}</button>
        ))}
      </form>}
    </div>
  );
}
