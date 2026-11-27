"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markExtra } from "@/app/actions";
import { pick, tr } from "@/lib/i18n";
import { ROUND_WORD, TRX, timeline, totalSec, type Block, type Session, type Settings } from "@/lib/trx";
import type { Lang } from "@/lib/types";
import { ActionForm, SubmitButton } from "../ActionForm";
import { ExerciseCard } from "./ExerciseCard";
import type { Replaces } from "./TrxApp";

let sharedAudio: AudioContext | null = null;

/** Call from the Start tap: iOS only allows sound and speech that begin in a user gesture. */
export function unlockAudio() {
  try {
    sharedAudio ??= new AudioContext();
    void sharedAudio.resume();
    if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch { /* no audio */ }
}

/** voice = beeps + spoken cues; beeps = beeps only; night = silent, vibration only, dark dimmed screen. */
export type SoundMode = "voice" | "beeps" | "night";
const MODE_KEY = "mc-trx-mode";
export const PROGRESS_KEY = "mc-trx-progress";

/** A workout in progress, kept so an accidental reload or a closed app can resume it. */
export interface Progress { session: Session; settings: Settings; i: number; leftMs: number; savedAt: number }

export function loadProgress(): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "null") as Progress | null;
    if (!p || Date.now() - p.savedAt > 3 * 3600_000 || !p.session?.exercises?.length) return null;
    return p;
  } catch { return null; }
}
export function clearProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch { /* ignore */ }
}

/**
 * Interval timer. Time is kept as an end timestamp, so a locked phone or a
 * throttled tab doesn't make it drift. Beeps for the last 3 s, a voice cue
 * for what comes next, a clear "round done" screen, and the screen stays on.
 */
export function TrxPlayer({ lang, session, settings, replaces, resume, onExit }: {
  lang: Lang; session: Session; settings: Settings; replaces: Replaces | null;
  resume?: { i: number; leftMs: number } | null; onExit: () => void;
}) {
  const he = lang === "he";
  const L = (x: { en: string; he: string }) => pick(lang, x);
  const blocks = useMemo(() => timeline(session, settings), [session, settings]);
  const startI = resume ? Math.min(resume.i, blocks.length - 1) : 0;
  const startMs = resume ? resume.leftMs : blocks[0].sec * 1000;
  const [i, setI] = useState(startI);
  const [left, setLeft] = useState(startMs);
  // A resumed workout starts paused, so it doesn't run off before you're back in position.
  const [paused, setPaused] = useState(!!resume);
  const [mode, setMode] = useState<SoundMode>("voice");
  const endsAt = useRef(performance.now() + startMs);
  const lastBeep = useRef(0);
  const done = i >= blocks.length;
  const b: Block | undefined = blocks[i];
  const loud = mode !== "night";

  useEffect(() => {
    try { const m = localStorage.getItem(MODE_KEY); if (m === "voice" || m === "beeps" || m === "night") setMode(m); } catch { /* ignore */ }
  }, []);
  const cycleMode = () => {
    const n: SoundMode = mode === "voice" ? "beeps" : mode === "beeps" ? "night" : "voice";
    setMode(n);
    if (n !== "voice") { try { speechSynthesis.cancel(); } catch { /* ignore */ } }
    try { localStorage.setItem(MODE_KEY, n); } catch { /* ignore */ }
  };

  // ---- sound / voice / vibration ----
  const beep = useCallback((freq: number, ms: number) => {
    if (!loud) return;
    try {
      const ctx = (sharedAudio ??= new AudioContext());
      if (ctx.state === "suspended") void ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + ms / 1000);
    } catch { /* no audio */ }
  }, [loud]);
  const say = useCallback((text: string) => {
    if (mode !== "voice" || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = he ? "he-IL" : "en-US";
      speechSynthesis.speak(u);
    } catch { /* no voice */ }
  }, [mode, he]);
  const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };

  // Any later tap (pause, skip) also re-unlocks audio if the phone suspended it.
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  // ---- keep the screen on ----
  useEffect(() => {
    if (done || paused || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = async () => { try { if (!document.hidden) lock = await navigator.wakeLock.request("screen"); } catch { /* denied */ } };
    void get();
    document.addEventListener("visibilitychange", get);
    return () => { document.removeEventListener("visibilitychange", get); void lock?.release().catch(() => {}); };
  }, [done, paused]);

  // ---- announce each block ----
  const first = useRef(true);
  useEffect(() => {
    if (first.current && resume) { first.current = false; return; } // no cue on a resumed, paused screen
    first.current = false;
    if (!b) {
      beep(880, 600);
      buzz([300, 120, 300]);
      say(he ? "כל הכבוד, סיימת את האימון" : "Well done, workout finished");
      return;
    }
    const name = L(TRX[b.ex].name);
    if (b.kind === "work") {
      beep(1320, 350);
      buzz(200);
      const newRound = b.round > 1 && blocks[i - 1]?.kind === "round-rest";
      if (b.side === 2) say(he ? "צד שני" : "Other side");
      else say((newRound ? (he ? `סבב ${L(ROUND_WORD[b.round - 1])}. ` : `Round ${b.round}. `) : "") + name);
    } else if (b.kind === "switch") {
      buzz(150);
      say(he ? "מחליפים צד" : "Switch sides");
    } else if (b.kind === "round-rest") {
      beep(660, 180);
      setTimeout(() => beep(990, 300), 220);
      buzz([200, 100, 200, 100, 200]);
      const doneR = b.round - 1;
      say(he ? `סבב ${L(ROUND_WORD[doneR - 1])} הושלם. מנוחה. הבא: ${name}` : `Round ${doneR} done. Rest. Next: ${name}`);
    } else {
      buzz([100, 80, 100]);
      say((he ? "מנוחה. הבא: " : "Rest. Next: ") + name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // ---- clock ----
  const go = useCallback((to: number) => {
    const n = Math.max(0, Math.min(to, blocks.length));
    setI(n);
    const ms = (blocks[n]?.sec ?? 0) * 1000;
    endsAt.current = performance.now() + ms;
    setLeft(ms);
    lastBeep.current = 0;
  }, [blocks]);

  useEffect(() => {
    if (done || paused) return;
    const id = setInterval(() => {
      const ms = endsAt.current - performance.now();
      if (ms <= 0) { go(i + 1); return; }
      const s = Math.ceil(ms / 1000);
      if (s <= 3 && s !== lastBeep.current) {
        lastBeep.current = s;
        if (loud) beep(880, 120); else buzz(60);
      }
      setLeft(ms);
    }, 100);
    return () => clearInterval(id);
  }, [i, done, paused, go, beep, loud]);

  // ---- save progress (resume after a reload or a closed app) ----
  const leftRef = useRef(left);
  leftRef.current = left;
  useEffect(() => {
    if (done) { clearProgress(); return; }
    const save = () => {
      const leftMs = paused ? leftRef.current : Math.max(0, endsAt.current - performance.now());
      const p: Progress = { session, settings, i, leftMs, savedAt: Date.now() };
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
    };
    save();
    const id = setInterval(save, 5000);
    document.addEventListener("visibilitychange", save);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", save); };
  }, [i, paused, done, session, settings]);

  const togglePause = () => {
    if (paused) endsAt.current = performance.now() + left;
    setPaused(!paused);
  };
  const addTime = (s: number) => {
    endsAt.current += s * 1000;
    setLeft((l) => l + s * 1000);
    lastBeep.current = 0;
  };
  const exit = () => {
    if (!window.confirm(he ? "לצאת מהאימון?" : "Leave the workout?")) return;
    clearProgress();
    onExit();
  };

  // ---- progress numbers ----
  const total = totalSec(blocks);
  const elapsed = blocks.slice(0, i).reduce((a, x) => a + x.sec, 0) + (b ? b.sec - left / 1000 : 0);
  const pct = Math.min(100, (elapsed / total) * 100);
  const secLeft = Math.max(0, Math.ceil(left / 1000));
  const nextWork = blocks.slice(i + 1).find((x) => x.kind === "work");
  const modeLabel = mode === "voice" ? (he ? "🗣 קול" : "🗣 Voice") : mode === "beeps" ? (he ? "🔔 צפצופים" : "🔔 Beeps") : (he ? "🌙 שקט" : "🌙 Quiet");

  if (done || !b) {
    return (
      <div className={`trx trx-play done${mode === "night" ? " night" : ""}`}>
        <div className="trx-big">🎉</div>
        <h1>{he ? "סיימת!" : "Done!"}</h1>
        <p>{he ? `${session.rounds} סבבים, ${session.exercises.length} תרגילים, ${Math.round(total / 60)} דקות.` : `${session.rounds} rounds, ${session.exercises.length} exercises, ${Math.round(total / 60)} min.`}</p>
        <p className="muted">{he ? "עכשיו 5 דקות גמישות." : "Now 5 min of mobility."}</p>
        {replaces && (
          <ActionForm action={markExtra} success={tr(lang)("fb_done")} error={tr(lang)("fb_failed")} redirectTo={`/day/${replaces.date}`} className="row" style={{ justifyContent: "center", margin: "12px 0" }}>
            <input type="hidden" name="date" value={replaces.date} />
            <input type="hidden" name="kind" value="strength" />
            <SubmitButton primary name="status" value="done">{he ? `סמן "${replaces.title}" כבוצע` : `Mark "${replaces.title}" done`}</SubmitButton>
          </ActionForm>
        )}
        <button className={replaces ? "" : "primary"} onClick={() => { clearProgress(); onExit(); }}>{he ? "חזרה" : "Back"}</button>
      </div>
    );
  }

  const isRest = b.kind !== "work";
  const roundDone = b.kind === "round-rest";
  const label =
    b.kind === "work" ? (he ? "עבודה" : "Work") :
    b.kind === "prep" ? (he ? "מתכוננים" : "Get ready") :
    b.kind === "switch" ? (he ? "מחליפים צד" : "Switch sides") :
    (he ? "מנוחה" : "Rest");
  const sideTxt = b.side ? (he ? (b.side === 1 ? "צד ראשון" : "צד שני") : (b.side === 1 ? "first side" : "other side")) : "";
  const exIndex = session.exercises.indexOf(b.ex) + 1; // position inside the round
  const toGo = session.rounds - b.round + 1;

  return (
    <div className={`trx trx-play k-${b.kind}${paused ? " paused" : ""}${mode === "night" ? " night" : ""}`}>
      <div className="trx-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
      <div className="spread trx-top">
        <button className="link" onClick={exit}>{he ? "✕ יציאה" : "✕ Exit"}</button>
        <RoundDots round={roundDone ? b.round - 1 : b.round} of={session.rounds} done={roundDone} he={he} />
        <button className="link trx-mode" onClick={cycleMode} aria-label={he ? `מצב שמע: ${modeLabel}` : `Sound mode: ${modeLabel}`}>{modeLabel}</button>
      </div>

      {roundDone ? (
        <div className="trx-round-done" role="status">
          <div className="trx-big">✅</div>
          <h2>{he ? `סבב ${L(ROUND_WORD[b.round - 2])} הושלם!` : `Round ${b.round - 1} done!`}</h2>
          <p className="muted">
            {he
              ? `${toGo === 1 ? "נשאר סבב אחרון" : `נשארו ${toGo} סבבים`}. לשתות, לנשום, לנער את הרגליים.`
              : `${toGo === 1 ? "One round left" : `${toGo} rounds left`}. Drink, breathe, shake out the legs.`}
          </p>
        </div>
      ) : (
        <div className="trx-phase">{label}{sideTxt && ` · ${sideTxt}`}</div>
      )}
      <div className="trx-clock" role="timer" aria-live="off">{secLeft}</div>
      <div className="trx-name">
        {roundDone ? (he ? `סבב ${b.round} מתחיל ב: ` : `Round ${b.round} starts with: `) : isRest && b.kind !== "switch" ? (he ? "הבא: " : "Next: ") : ""}
        <bdi>{L(TRX[b.ex].name)}</bdi>
        {exIndex > 0 && <span className="muted trx-pos"> · <bdi>{exIndex}/{session.exercises.length}</bdi></span>}
      </div>
      {isRest && (
        <div className="row" style={{ justifyContent: "center", marginBottom: 8 }}>
          <button onClick={() => addTime(15)}>+15 {he ? "שנ'" : "s"}</button>
          <button onClick={() => go(i + 1)}>{he ? "דלג על המנוחה" : "Skip rest"}</button>
        </div>
      )}

      <ExerciseCard key={b.ex} id={b.ex} lang={lang} paused={paused} />

      {b.kind === "work" && nextWork && nextWork.ex !== b.ex && (
        <p className="muted" style={{ textAlign: "center" }}>
          {nextWork.round !== b.round ? (he ? "אחרי זה: סוף הסבב" : "Then: end of the round") : <>{he ? "אחרי זה: " : "Then: "}{L(TRX[nextWork.ex].name)}</>}
        </p>
      )}
      {b.kind === "work" && !nextWork && <p className="muted" style={{ textAlign: "center" }}>{he ? "התרגיל האחרון!" : "Last one!"}</p>}

      <div className="trx-ctrl">
        <button onClick={() => go(i - 1)} disabled={i === 0} aria-label={he ? "הקודם" : "Previous"}>{he ? "⏭" : "⏮"}</button>
        <button className="primary" onClick={togglePause}>{paused ? (he ? "▶ המשך" : "▶ Resume") : (he ? "⏸ השהה" : "⏸ Pause")}</button>
        <button onClick={() => go(i + 1)} aria-label={he ? "הבא" : "Next"}>{he ? "⏮" : "⏭"}</button>
      </div>
    </div>
  );
}

function RoundDots({ round, of, done, he }: { round: number; of: number; done: boolean; he: boolean }) {
  return (
    <span className="trx-dots" role="img" aria-label={he ? `סבב ${round} מתוך ${of}` : `Round ${round} of ${of}`}>
      {Array.from({ length: of }, (_, k) => (
        <span key={k} className={k + 1 < round || (done && k + 1 === round) ? "full" : k + 1 === round ? "now" : ""} />
      ))}
    </span>
  );
}
