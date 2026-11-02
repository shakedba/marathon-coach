import { guideFor } from "@/lib/exercise-guide";
import { pick } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { ExerciseFigure } from "./ExerciseFigure";

export function ExerciseHowTo({ id, lang, uid }: { id: string; lang: Lang; uid?: string }) {
  const g = guideFor(id);
  if (!g) return null;
  const he = lang === "he";
  return (
    <div className="howto">
      <ExerciseFigure fig={g.fig} label={pick(lang, g.name)} uid={uid ?? id} />
      <p className="muted" style={{ margin: "6px 0" }}>{he ? "עובד על: " : "Works: "}{pick(lang, g.target)}</p>
      <ol style={{ margin: "4px 0", paddingInlineStart: 20 }}>
        {g.steps.map((s, i) => <li key={i}>{pick(lang, s)}</li>)}
      </ol>
      <p style={{ margin: "6px 0" }}>✅ <b>{he ? "דגש: " : "Focus: "}</b>{pick(lang, g.cue)}</p>
      <p style={{ margin: "6px 0" }}>⚠️ <b>{he ? "טעות נפוצה: " : "Common mistake: "}</b>{pick(lang, g.mistake)}</p>
    </div>
  );
}
