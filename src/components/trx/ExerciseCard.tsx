"use client";
import { useEffect, useState } from "react";
import { pick } from "@/lib/i18n";
import { TRX } from "@/lib/trx";
import type { Lang, Text } from "@/lib/types";
import { TrxFigure } from "./TrxFigure";

/** Animated figure + how-to. Shared by the library and the player. */
export function ExerciseCard({ id, lang, full, paused }: { id: string; lang: Lang; full?: boolean; paused?: boolean }) {
  const he = lang === "he";
  const e = TRX[id];
  const L = (x: Text) => pick(lang, x);
  const [userPlay, setUserPlay] = useState<boolean | null>(null);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  const playing = !paused && (userPlay ?? !reduce);
  return (
    <div className="trx-ex">
      <div className="trx-stage">
        <TrxFigure rig={e.rig} playing={playing} label={L(e.name)} />
        {e.rig.b && !paused && (
          <button className="trx-pp" onClick={() => setUserPlay(!playing)}>{playing ? (he ? "⏸ עצור" : "⏸ Pause") : (he ? "▶ הפעל" : "▶ Play")}</button>
        )}
      </div>
      {e.hold && <p className="muted" style={{ margin: "4px 0" }}>{he ? "תרגיל החזקה: לא זזים, רק נושמים." : "Hold: stay still and breathe."}</p>}
      <p style={{ margin: "6px 0" }}><b>{he ? "הכנה: " : "Setup: "}</b>{L(e.setup)}</p>
      {full && <p className="muted" style={{ margin: "6px 0" }}>{he ? "עובד על: " : "Works: "}{L(e.target)}</p>}
      <ol style={{ margin: "4px 0", paddingInlineStart: 20 }}>
        {e.steps.map((s, i) => <li key={i}>{L(s)}</li>)}
      </ol>
      <p style={{ margin: "6px 0" }}>✅ <b>{he ? "דגש: " : "Focus: "}</b>{L(e.cue)}</p>
      {full && (
        <>
          <p style={{ margin: "6px 0" }}>⚠️ <b>{he ? "טעות נפוצה: " : "Common mistake: "}</b>{L(e.mistake)}</p>
          <p style={{ margin: "6px 0" }}>⬇️ <b>{he ? "קל יותר: " : "Easier: "}</b>{L(e.easier)}</p>
          <p style={{ margin: "6px 0" }}>⬆️ <b>{he ? "קשה יותר: " : "Harder: "}</b>{L(e.harder)}</p>
        </>
      )}
    </div>
  );
}
