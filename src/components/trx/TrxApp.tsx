"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pick } from "@/lib/i18n";
import { DEFAULTS, SESSIONS, TRX, timeline, totalSec, type Advice, type Session, type Settings } from "@/lib/trx";
import type { Lang, Text } from "@/lib/types";
import { TrxFigure } from "./TrxFigure";
import { ExerciseCard } from "./ExerciseCard";
import { TrxPlayer, unlockAudio } from "./TrxPlayer";

const KEY = "mc-trx-settings";
const AREA: Record<string, Text> = {
  legs: { en: "Legs", he: "רגליים" },
  upper: { en: "Upper body", he: "פלג גוף עליון" },
  core: { en: "Core", he: "ליבה" },
};

type View = { v: "home" } | { v: "ex"; id: string } | { v: "play"; session: Session };

export interface Replaces { date: string; title: string; today: boolean }

export function TrxApp({ lang, advice, initial, replaces }: { lang: Lang; advice: Advice; initial: { session: Session["id"]; rounds: number } | null; replaces: Replaces | null }) {
  const he = lang === "he";
  const L = (x: Text) => pick(lang, x);
  const [view, setView] = useState<View>({ v: "home" });
  const [set, setSet] = useState<Settings>({ ...DEFAULTS, rounds: initial?.rounds ?? (advice.rounds || 2) });
  const [sessionId, setSessionId] = useState<Session["id"]>(initial?.session ?? advice.session ?? "full");

  // Remembered work/rest choice (per browser; best effort).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved && typeof saved.work === "number" && typeof saved.rest === "number") setSet((s) => ({ ...s, work: saved.work, rest: saved.rest }));
    } catch { /* storage unavailable */ }
  }, []);
  const update = (p: Partial<Settings>) => {
    setSet((s) => {
      const n = { ...s, ...p };
      try { localStorage.setItem(KEY, JSON.stringify({ work: n.work, rest: n.rest })); } catch { /* ignore */ }
      return n;
    });
  };

  const session = SESSIONS.find((s) => s.id === sessionId)!;
  const minutes = useMemo(() => Math.round(totalSec(timeline(session, set)) / 60), [session, set]);

  if (view.v === "play") return <TrxPlayer lang={lang} session={view.session} settings={set} replaces={replaces} onExit={() => setView({ v: "home" })} />;

  if (view.v === "ex") {
    const e = TRX[view.id];
    return (
      <div className="trx">
        <div className="trx-top">
          <button className="link" onClick={() => setView({ v: "home" })}>{he ? "› חזרה" : "‹ Back"}</button>
        </div>
        <h1>{L(e.name)}</h1>
        <ExerciseCard id={view.id} lang={lang} full />
      </div>
    );
  }

  return (
    <div className="trx">
      <div className="trx-top">
        <Link href="/more" className="link">{he ? "› מאמן מרתון" : "‹ Marathon Coach"}</Link>
      </div>
      <h1>TRX</h1>

      {replaces && (
        <div className="card trx-replaces">
          <b>{he ? "במקום: " : "Instead of: "}{replaces.title}</b>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {replaces.today ? (he ? "האימון של היום. " : "Today's session. ") : (he ? `האימון של ${replaces.date.slice(8)}/${replaces.date.slice(5, 7)}. ` : `Session of ${replaces.date}. `)}
            {he ? "בסוף האימון אפשר לסמן אותו כבוצע." : "Mark it done at the end."}
          </p>
        </div>
      )}
      <div className="card">
        <b>{he ? "השבוע" : "This week"}</b>
        <p style={{ margin: "4px 0 0" }}>
          {advice.session
            ? (he ? `${advice.perWeek === 1 ? "פעם אחת" : `${advice.perWeek} פעמים`}: ${L(SESSIONS.find((s) => s.id === advice.session)!.name)}, ${advice.rounds} סבבים.` : `${advice.perWeek}× ${L(SESSIONS.find((s) => s.id === advice.session)!.name)}, ${advice.rounds} rounds.`)
            : (he ? "בלי TRX השבוע." : "No TRX this week.")}
        </p>
        <p className="muted" style={{ margin: "4px 0 0" }}>{L(advice.why)}</p>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {he ? "במקום אימון הכוח שבתוכנית (לא בנוסף). לסיים בתחושה שיכולת עוד." : "Instead of the planned strength session, not on top of it. Finish feeling you could do more."}
        </p>
      </div>

      <h2>{he ? "אימון" : "Workout"}</h2>
      <div className="trx-seg" role="radiogroup" aria-label={he ? "סוג אימון" : "Session"}>
        {SESSIONS.map((s) => (
          <button key={s.id} role="radio" aria-checked={s.id === sessionId} className={s.id === sessionId ? "on" : ""} onClick={() => { setSessionId(s.id); update({ rounds: s.id === advice.session ? advice.rounds : s.rounds }); }}>
            {L(s.name)}
          </button>
        ))}
      </div>
      <p className="muted">{L(session.sub)}</p>

      <div className="card">
        <Stepper label={he ? "סבבים" : "Rounds"} value={set.rounds} options={[1, 2, 3]} onChange={(rounds) => update({ rounds })} />
        <Stepper label={he ? "עבודה (שנ')" : "Work (s)"} value={set.work} options={[30, 40, 45]} onChange={(work) => update({ work })} />
        <Stepper label={he ? "מנוחה (שנ')" : "Rest (s)"} value={set.rest} options={[15, 20, 30]} onChange={(rest) => update({ rest })} />
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {he ? `כ-${minutes} דקות. תרגיל לכל צד: ${Math.max(20, set.work - 10)} שנ' לכל צד.` : `About ${minutes} min. One-side exercises: ${Math.max(20, set.work - 10)} s per side.`}
        </p>
        <button className="primary trx-go" onClick={() => { unlockAudio(); setView({ v: "play", session: { ...session, rounds: set.rounds } }); }}>
          ▶ {he ? "התחל אימון" : "Start workout"}
        </button>
      </div>

      <h2>{he ? "התרגילים באימון" : "Exercises in this workout"}</h2>
      <ul className="trx-list">
        {session.exercises.map((id) => (
          <li key={id}>
            <button onClick={() => setView({ v: "ex", id })}>
              <span className="trx-thumb"><TrxFigure rig={TRX[id].rig} playing={false} label={L(TRX[id].name)} /></span>
              <span className="tx">
                <b>{L(TRX[id].name)}</b>
                <span className="muted">{L(AREA[TRX[id].area])}{TRX[id].perSide ? (he ? " · לכל צד" : " · each side") : ""}{TRX[id].hold ? (he ? " · החזקה" : " · hold") : ""}</span>
              </span>
              <span className="chev" aria-hidden>›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stepper({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (v: number) => void }) {
  return (
    <div className="spread trx-step">
      <span>{label}</span>
      <span className="trx-seg small" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} role="radio" aria-checked={o === value} className={o === value ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
        ))}
      </span>
    </div>
  );
}
