import { markSkipped } from "@/app/actions";
import { tr } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { ActionForm, SubmitButton } from "./ActionForm";

/** Collapsed "not training today" -> reasons. */
export function SkipInline({ date, lang }: { date: string; lang: Lang }) {
  const t = tr(lang);
  return (
    <details className="skip">
      <summary>{lang === "he" ? "לא מתאמן היום" : "Not training today"}</summary>
      <ActionForm action={markSkipped} success={t("fb_skipped")} error={t("fb_failed")} className="row" style={{ marginTop: 8 }}>
        <input type="hidden" name="date" value={date} />
        {(["time", "tired", "ill", "fever", "niggle"] as const).map((r) => (
          <SubmitButton key={r} name="reason" value={r}>{t(`reason_${r}`)}</SubmitButton>
        ))}
      </ActionForm>
    </details>
  );
}
