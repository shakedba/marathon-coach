"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pick } from "@/lib/i18n";
import { DEFAULTS, SESSIONS, TRX, customSession, timeline, totalSec, type Advice, type Area, type Session, type Settings } from "@/lib/trx";
import type { Lang, Text } from "@/lib/types";
import { TrxFigure } from "./TrxFigure";
import { ExerciseCard } from "./ExerciseCard";
import { TrxPlayer, clearProgress, loadProgress, unlockAudio, type Progress } from "./TrxPlayer";

const KEY = "mc-trx-settings";
const CUSTOM_KEY = "mc-trx-custom";
const AREA: Record<string, Text> = {
  legs: { en: "Legs", he: "רגליים" },
  upper: { en: "Upper body", he: "פלג גוף עליון" },
  core: { en: "Core", he: "ליבה" },
};

type View = { v: "home" } | { v: "ex"; id: string } | { v: "play"; session: Session; settings: Settings; resume?: { i: number; leftMs: number } };

export interface Replaces { date: string; title: string; today: boolean }

export function TrxApp({ lang, advice, initial, replaces }: { lang: Lang; advice: Advice; initial: { session: Session["id"]; rounds: number } | null; replaces: Replaces | null }) {
  const he = lang === "he";
  const L = (x: Text) => pick(lang, x);
  const [view, setView] = useState<View>({ v: "home" });
  const [set, setSet] = useState<Settings>({ ...DEFAULTS, rounds: initial?.rounds ?? (advice.rounds || 2) });
  const [sessionId, setSessionId] = useState<Session["id"]>(initial?.session ?? advice.session ?? "full");

  const [custom, setCustom] = useState<string[]>([]);
  const [paused, setPausedRun] = useState<Progress | null>(null);

  // Remembered work/rest choice, own workout and an unfinished run (per browser; best effort).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved && typeof saved.work === "number" && typeof saved.rest === "number") setSet((s) => ({ ...s, work: saved.work, rest: saved.rest }));
      setCustom(customSession(JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]")).exercises);
    } catch { /* storage unavailable */ }
    setPausedRun(loadProgress());
  }, []);
  const saveCustom = (ids: string[]) => {
    setCustom(ids);
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  };
  const update = (p: Partial<Settings>) => {
    setSet((s) => {
      const n = { ...s, ...p };
      try { localStorage.setItem(KEY, JSON.stringify({ work: n.work, rest: n.rest })); } catch { /* ignore */ }
      return n;
    });
  };

  const session = sessionId === "custom" ? customSession(custom, set.rounds) : SESSIONS.find((s) => s.id === sessionId)!;
  const minutes = useMemo(() => Math.round(totalSec(timeline(session, set)) / 60), [session, set]);

  if (view.v === "play") {
    return <TrxPlayer lang={lang} session={view.session} settings={view.settings} resume={view.resume} replaces={replaces}
      onExit={() => { setPausedRun(null); setView({ v: "home" }); }} />;
  }

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

      {paused && (
        <div className="card trx-replaces">
          <b>{he ? "יש אימון שלא הסתיים" : "Unfinished workout"}</b>
          <p className="muted" style={{ margin: "4px 0 8px" }}>
            {L(paused.session.name)} · {he ? "סבב" : "round"} {timeline(paused.session, paused.settings)[paused.i]?.round ?? 1}/{paused.settings.rounds}
          </p>
          <div className="row">
            <button className="primary" onClick={() => { unlockAudio(); setView({ v: "play", session: paused.session, settings: paused.settings, resume: { i: paused.i, leftMs: paused.leftMs } }); }}>▶ {he ? "המשך מאיפה שעצרתי" : "Resume"}</button>
            <button onClick={() => { clearProgress(); setPausedRun(null); }}>{he ? "בטל" : "Discard"}</button>
          </div>
        </div>
      )}

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
        {[...SESSIONS, customSession(custom)].map((s) => (
          <button key={s.id} role="radio" aria-checked={s.id === sessionId} className={s.id === sessionId ? "on" : ""} onClick={() => { setSessionId(s.id); update({ rounds: s.id === advice.session ? advice.rounds : s.rounds }); }}>
            {L(s.name)}
          </button>
        ))}
      </div>
      <p className="muted">{L(session.sub)}</p>
      {sessionId === "custom" && <CustomEditor lang={lang} ids={custom} onChange={saveCustom} onOpen={(id) => setView({ v: "ex", id })} />}

      <div className="card">
        <Stepper label={he ? "סבבים" : "Rounds"} value={set.rounds} options={[1, 2, 3]} onChange={(rounds) => update({ rounds })} />
        <Stepper label={he ? "עבודה (שנ')" : "Work (s)"} value={set.work} options={[30, 40, 45]} onChange={(work) => update({ work })} />
        <Stepper label={he ? "מנוחה (שנ')" : "Rest (s)"} value={set.rest} options={[15, 20, 30]} onChange={(rest) => update({ rest })} />
        <p className="muted" style={{ margin: "8px 0 0" }}>
          {he ? `כ-${minutes} דקות. תרגיל לכל צד: ${Math.max(20, set.work - 10)} שנ' לכל צד.` : `About ${minutes} min. One-side exercises: ${Math.max(20, set.work - 10)} s per side.`}
        </p>
        <button className="primary trx-go" disabled={!session.exercises.length} onClick={() => { unlockAudio(); clearProgress(); setPausedRun(null); setView({ v: "play", session: { ...session, rounds: set.rounds }, settings: set }); }}>
          ▶ {session.exercises.length ? (he ? "התחל אימון" : "Start workout") : (he ? "בחר לפחות תרגיל אחד" : "Pick at least one exercise")}
        </button>
      </div>

      {sessionId !== "custom" && <>
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
      </>}
    </div>
  );
}

const AREAS: Area[] = ["legs", "upper", "core"];

/** Build your own workout from the whole library: add, remove and reorder. */
function CustomEditor({ lang, ids, onChange, onOpen }: { lang: Lang; ids: string[]; onChange: (ids: string[]) => void; onOpen: (id: string) => void }) {
  const he = lang === "he";
  const L = (x: Text) => pick(lang, x);
  const [status, setStatus] = useState("");
  const move = (k: number, d: -1 | 1) => {
    const n = [...ids];
    [n[k], n[k + d]] = [n[k + d], n[k]];
    onChange(n);
    setStatus(he ? `${L(TRX[ids[k]].name)}: מקום ${k + d + 1} מתוך ${ids.length}` : `${L(TRX[ids[k]].name)}: position ${k + d + 1} of ${ids.length}`);
  };
  const areaCount = (a: Area) => ids.filter((id) => TRX[id].area === a).length;
  return (
    <>
      <p className="sr" role="status">{status}</p>
      <div className="card">
        <div className="spread">
          <b>{he ? `האימון שלי (${ids.length})` : `My workout (${ids.length})`}</b>
          {ids.length > 0 && <button className="link" onClick={() => onChange([])}>{he ? "נקה" : "Clear"}</button>}
        </div>
        {ids.length === 0 ? (
          <p className="muted" style={{ margin: "6px 0 0" }}>{he ? "הוסף תרגילים מהספרייה למטה. הסדר כאן הוא סדר הביצוע בכל סבב." : "Add exercises from the library below. This order is the order in each round."}</p>
        ) : (
          <>
            <ol className="trx-pick">
              {ids.map((id, k) => (
                <li key={id}>
                  <span className="trx-thumb sm"><TrxFigure rig={TRX[id].rig} playing={false} label="" /></span>
                  <button className="link tx" onClick={() => onOpen(id)}>{L(TRX[id].name)}</button>
                  <button onClick={() => move(k, -1)} disabled={k === 0} aria-label={he ? "הזז למעלה" : "Move up"}>▲</button>
                  <button onClick={() => move(k, 1)} disabled={k === ids.length - 1} aria-label={he ? "הזז למטה" : "Move down"}>▼</button>
                  <button onClick={() => onChange(ids.filter((x) => x !== id))} aria-label={he ? "הסר" : "Remove"}>✕</button>
                </li>
              ))}
            </ol>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {AREAS.map((a) => `${L(AREA[a])}: ${areaCount(a)}`).join(" · ")}
              {areaCount("legs") > 0 && areaCount("upper") + areaCount("core") > 0 ? "" : (he ? " · כדאי לשלב רגליים, עליון וליבה" : " · mix legs, upper body and core")}
            </p>
          </>
        )}
      </div>
      <h2>{he ? "הספרייה" : "Library"}</h2>
      {AREAS.map((a) => (
        <div key={a}>
          <h3 className="muted" style={{ margin: "10px 0 4px", fontSize: ".95rem" }}>{L(AREA[a])}</h3>
          <ul className="trx-list">
            {Object.entries(TRX).filter(([, e]) => e.area === a).map(([id, e]) => {
              const on = ids.includes(id);
              return (
                <li key={id} className="trx-lib">
                  <button onClick={() => onOpen(id)} className="trx-lib-open">
                    <span className="trx-thumb"><TrxFigure rig={e.rig} playing={false} label={L(e.name)} /></span>
                    <span className="tx"><b>{L(e.name)}</b><span className="muted">{L(e.target)}</span></span>
                  </button>
                  <button className={`trx-add${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChange(on ? ids.filter((x) => x !== id) : [...ids, id])}>
                    {on ? "✓" : "+"}<span className="sr">{on ? (he ? "הסר מהאימון" : "Remove") : (he ? "הוסף לאימון" : "Add")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
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
