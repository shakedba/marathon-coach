import { ExerciseHowTo } from "@/components/ExerciseHowTo";
import { GUIDE } from "@/lib/exercise-guide";
import { pick } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

const GROUPS: { title: { en: string; he: string }; ids: string[] }[] = [
  { title: { en: "Strength A (bodyweight)", he: "כוח A (משקל גוף)" }, ids: ["squat", "reverse-lunge", "glute-bridge", "calf-raise", "side-plank", "dead-bug", "clamshell", "bird-dog"] },
  { title: { en: "Core & hips (C)", he: "ליבה וירכיים (C)" }, ids: ["monster-walk"] },
  { title: { en: "Strength B (dumbbells, from December)", he: "כוח B (משקולות, מדצמבר)" }, ids: ["bulgarian", "step-up", "sl-rdl", "hip-thrust", "pull-up", "copenhagen"] },
  { title: { en: "Plyometrics (from January)", he: "פליאומטריקה (מינואר)" }, ids: ["pogo", "a-skip"] },
  { title: { en: "Mobility (after runs)", he: "גמישות (אחרי ריצה)" }, ids: ["hip-flexor", "calf-wall", "hamstring-strap", "figure-4", "open-book", "knee-to-wall"] },
];

export default async function ExercisesPage() {
  const lang = await getLang();
  return (
    <>
      <h1>{lang === "he" ? "ספריית תרגילים" : "Exercise library"}</h1>
      {GROUPS.map((g) => (
        <div className="card" key={g.title.en}>
          <h2 style={{ marginTop: 0 }}>{pick(lang, g.title)}</h2>
          {g.ids.map((id) => (
            <details key={id} className="ex">
              <summary><span>{pick(lang, GUIDE[id].name)}</span></summary>
              <ExerciseHowTo id={id} lang={lang} />
            </details>
          ))}
        </div>
      ))}
    </>
  );
}
