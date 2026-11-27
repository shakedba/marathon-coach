"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pick } from "@/lib/i18n";
import { TRX, timeline, totalSec, type Block, type Session, type Settings } from "@/lib/trx";
import type { Lang } from "@/lib/types";
import { markExtra } from "@/app/actions";
import { tr } from "@/lib/i18n";
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

/**
 * Interval timer. Time is kept as an end timestamp, so a locked phone or a
 * throttled tab doesn't make it drift. Beeps for the last 3 s, a voice cue
 * for what comes next, and the screen stays on while it runs.
 */
export function TrxPlayer({ lang, session, settings, replaces, onExit }: { lang: Lang; session: Session; settings: Settings; replaces: Replaces | null; onExit: () => void }) {
  const he = lang === "he";
  const blocks = useMemo(() => timeline(session, settings), [session, settings]);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(blocks[0].sec * 1000);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const endsAt = useRef(performance.now() + blocks[0].sec * 1000);
  const lastBeep = useRef(0);
  const done = i >= blocks.length;
  const b: Block | undefined = blocks[i];

  // ---- sound / voice / vibration ----
  const beep = useCallback((freq: number, ms: number) => {
    if (!sound) return;
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
  }, [sound]);
  const say = useCallback((text: string) => {
    if (!sound || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = he ? "he-IL" : "en-US";
      speechSynthesis.speak(u);
    } catch { /* no voice */ }
  }, [sound, he]);

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
  useEffect(() => {
    if (!b) {
      beep(880, 600);
      say(he ? "כל הכבוד, סיימת" : "Well done, finished");
      return;
    }
    const name = pick(lang, TRX[b.ex].name);
    if (b.kind === "work") {
      beep(1320, 350);
      navigator.vibrate?.(200);
      if (b.side === 2) say(he ? "צד שני" : "Other side");
      else say(name);
    } else if (b.kind === "switch") {
      say(he ? "מחליפים צד" : "Switch sides");
    } else {
      navigator.vibrate?.([100, 80, 100]);
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
      if (s <= 3 && s !== lastBeep.current) { lastBeep.current = s; beep(880, 120); }
      setLeft(ms);
    }, 100);
    return () => clearInterval(id);
  }, [i, done, paused, go, beep]);

  const togglePause = () => {
    if (paused) endsAt.current = performance.now() + left;
    setPaused(!paused);
  };

  // ---- progress numbers ----
  const total = totalSec(blocks);
  const elapsed = blocks.slice(0, i).reduce((a, x) => a + x.sec, 0) + (b ? b.sec - left / 1000 : 0);
  const pct = Math.min(100, (elapsed / total) * 100);
  const secLeft = Math.max(0, Math.ceil(left / 1000));
  const nextWork = blocks.slice(i + 1).find((x) => x.kind === "work");

  if (done || !b) {
    return (
      <div className="trx trx-play done">
        <div className="trx-big">🎉</div>
        <h1>{he ? "סיימת!" : "Done!"}</h1>
        <p>{he ? `${session.rounds} סבבים, ${Math.round(total / 60)} דקות.` : `${session.rounds} rounds, ${Math.round(total / 60)} min.`}</p>
        <p className="muted">{he ? "עכשיו 5 דקות גמישות." : "Now 5 min of mobility."}</p>
        {replaces && (
          <ActionForm action={markExtra} success={tr(lang)("fb_done")} error={tr(lang)("fb_failed")} redirectTo={`/day/${replaces.date}`} className="row" style={{ justifyContent: "center", margin: "12px 0" }}>
            <input type="hidden" name="date" value={replaces.date} />
            <input type="hidden" name="kind" value="strength" />
            <SubmitButton primary name="status" value="done">{he ? `סמן "${replaces.title}" כבוצע` : `Mark "${replaces.title}" done`}</SubmitButton>
          </ActionForm>
        )}
        <button className={replaces ? "" : "primary"} onClick={onExit}>{he ? "חזרה" : "Back"}</button>
      </div>
    );
  }

  const label =
    b.kind === "work" ? (he ? "עבודה" : "Work") :
    b.kind === "prep" ? (he ? "מתכוננים" : "Get ready") :
    b.kind === "switch" ? (he ? "מחליפים צד" : "Switch sides") :
    b.kind === "round-rest" ? (he ? "מנוחה בין סבבים" : "Round rest") :
    (he ? "מנוחה" : "Rest");
  const sideTxt = b.side ? (he ? (b.side === 1 ? "צד ראשון" : "צד שני") : (b.side === 1 ? "first side" : "other side")) : "";

  return (
    <div className={`trx trx-play k-${b.kind}${paused ? " paused" : ""}`}>
      <div className="trx-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
      <div className="spread trx-top">
        <button className="link" onClick={() => { if (confirmExit(he)) onExit(); }}>{he ? "✕ יציאה" : "✕ Exit"}</button>
        <span className="muted">{he ? `סבב ${b.round}/${session.rounds}` : `Round ${b.round}/${session.rounds}`}</span>
        <button className="link" onClick={() => setSound(!sound)} aria-pressed={sound}>{sound ? "🔊" : "🔇"}<span className="sr">{he ? "קול" : "Sound"}</span></button>
      </div>

      <div className="trx-phase">{label}{sideTxt && ` · ${sideTxt}`}</div>
      <div className="trx-clock" role="timer" aria-live="off">{secLeft}</div>
      <div className="trx-name">
        {b.kind === "work" || b.kind === "switch" ? "" : (he ? "הבא: " : "Next: ")}
        {pick(lang, TRX[b.ex].name)}
      </div>

      <ExerciseCard key={b.ex} id={b.ex} lang={lang} paused={paused} />

      {b.kind === "work" && nextWork && nextWork.ex !== b.ex && (
        <p className="muted" style={{ textAlign: "center" }}>{he ? "אחרי זה: " : "Then: "}{pick(lang, TRX[nextWork.ex].name)}</p>
      )}

      <div className="trx-ctrl">
        <button onClick={() => go(i - 1)} disabled={i === 0} aria-label={he ? "הקודם" : "Previous"}>{he ? "⏭" : "⏮"}</button>
        <button className="primary" onClick={togglePause}>{paused ? (he ? "▶ המשך" : "▶ Resume") : (he ? "⏸ השהה" : "⏸ Pause")}</button>
        <button onClick={() => go(i + 1)} aria-label={he ? "הבא" : "Next"}>{he ? "⏮" : "⏭"}</button>
      </div>
    </div>
  );
}

function confirmExit(he: boolean) {
  // A native confirm is fine here: it is an explicit tap, mid-workout.
  return window.confirm(he ? "לצאת מהאימון?" : "Leave the workout?");
}
