import { markDone, markSkipped } from "@/app/actions";
import { tr } from "@/lib/i18n";
import { ActionForm, SubmitButton } from "./ActionForm";
import type { Lang } from "@/lib/types";

export function DayActions({ date, lang, ask, ran }: { date: string; lang: Lang; ask?: boolean; ran?: boolean }) {
  const t = tr(lang);
  return (
    <div className="card">
      {ask && <p style={{ marginTop: 0 }}>{t("missedAsk")}</p>}
      <ActionForm action={markDone} success={t("fb_done")} error={t("fb_failed")} className="row">
        <input type="hidden" name="date" value={date} />
        <select name="feel" style={{ width: 130 }} defaultValue="" aria-label={t("feel")}>
          <option value="">{t("feel")}</option>
          {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <SubmitButton primary pendingLabel={t("fb_saving")}>{t("done")}</SubmitButton>
      </ActionForm>
      {!ran && <ActionForm action={markSkipped} success={t("fb_skipped")} error={t("fb_failed")} className="row" style={{ marginTop: 10 }}>
        <input type="hidden" name="date" value={date} />
        <span className="muted">{t("skipped")} – {t("why")}</span>
        {(["time", "tired", "ill", "fever", "niggle"] as const).map((r) => (
          <SubmitButton key={r} name="reason" value={r}>{t(`reason_${r}`)}</SubmitButton>
        ))}
      </ActionForm>}
    </div>
  );
}
