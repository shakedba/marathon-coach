import { rateEffort } from "@/app/actions";
import { tr } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { ActionForm, SubmitButton } from "./ActionForm";

/** One tap = saved. Session RPE (CR-10). */
export function EffortChips({ date, lang, value }: { date: string; lang: Lang; value?: number | null }) {
  const he = lang === "he";
  return (
    <ActionForm action={rateEffort} success={he ? "המאמץ נשמר" : "Effort saved"} error={tr(lang)("fb_failed")} className="effort">
      <input type="hidden" name="date" value={date} />
      <div className="effort-label">
        <span>{he ? "כמה קשה היה?" : "How hard was it?"}</span>
        <span className="muted">{he ? "1 קל מאוד · 10 מקסימלי" : "1 very easy · 10 max"}</span>
      </div>
      <div className="chips" role="group" aria-label={tr(lang)("feel")}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <SubmitButton key={n} name="feel" value={String(n)} primary={value === n}>{n}</SubmitButton>
        ))}
      </div>
    </ActionForm>
  );
}
