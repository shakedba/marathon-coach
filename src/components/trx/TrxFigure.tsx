"use client";
import { useEffect, useRef } from "react";
import { FLOOR, LEN, lerpPose, pts, repPhase, skeleton, strapLines, type Pose, type Rig } from "@/lib/trx-figure";

/**
 * Animated TRX stick figure. Moves between the rig's two poses while `playing`;
 * stopped (or for holds) it shows the start pose with the end pose faded behind it.
 * The loop stops while the tab is hidden.
 */
export function TrxFigure({ rig, playing, label, period = 3200 }: { rig: Rig; playing: boolean; label: string; period?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const moving = playing && !!rig.b;

  useEffect(() => {
    const svg = ref.current;
    if (!svg || !rig.b) return;
    const b = rig.b;
    if (!moving) {
      draw(svg, rig, rig.a);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      draw(svg, rig, lerpPose(rig.a, b, repPhase(now - t0, period)));
      raf = requestAnimationFrame(frame);
    };
    const start = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); };
    start();
    document.addEventListener("visibilitychange", start);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", start); };
  }, [rig, moving, period]);

  const a = skeleton(rig.a, rig);
  const ghost = rig.b && !moving ? skeleton(rig.b, rig) : null;
  return (
    <svg ref={ref} viewBox="0 0 200 130" className="trx-fig" role="img" aria-label={label}>
      <line x1="0" y1={FLOOR + 1} x2="200" y2={FLOOR + 1} stroke="var(--line)" strokeWidth="2" />
      <circle cx={rig.anchor[0]} cy={rig.anchor[1]} r="3" fill="var(--muted)" />
      {ghost && <Body s={ghost} rig={rig} ghost />}
      <Body s={a} rig={rig} />
    </svg>
  );
}

function Body({ s, rig, ghost }: { s: ReturnType<typeof skeleton>; rig: Rig; ghost?: boolean }) {
  const cls = ghost ? "ghost" : "live";
  return (
    <g className={cls} opacity={ghost ? 0.22 : 1}>
      {strapLines(s, rig).map((l, i) => <polyline key={i} data-k={`strap${i}`} points={pts(l)} className="strap" />)}
      <polyline data-k="farLeg" points={pts(s.far.leg)} className="limb far" />
      <polyline data-k="farArm" points={pts(s.far.arm)} className="limb far" />
      <polyline data-k="torso" points={pts([s.hip, s.neck])} className="limb torso" />
      <polyline data-k="nearLeg" points={pts(s.near.leg)} className="limb" />
      <polyline data-k="nearArm" points={pts(s.near.arm)} className="limb" />
      <circle data-k="head" cx={s.head[0]} cy={s.head[1]} r={LEN.headR} className="head" />
    </g>
  );
}

/** Updates the live figure in place (no React render per frame). */
function draw(svg: SVGSVGElement, rig: Rig, pose: Pose) {
  const s = skeleton(pose, rig);
  const g = svg.querySelector("g.live");
  if (!g) return;
  const set = (k: string, v: string) => g.querySelector(`[data-k="${k}"]`)?.setAttribute("points", v);
  strapLines(s, rig).forEach((l, i) => set(`strap${i}`, pts(l)));
  set("farLeg", pts(s.far.leg));
  set("farArm", pts(s.far.arm));
  set("torso", pts([s.hip, s.neck]));
  set("nearLeg", pts(s.near.leg));
  set("nearArm", pts(s.near.arm));
  const h = g.querySelector('[data-k="head"]');
  h?.setAttribute("cx", s.head[0].toFixed(1));
  h?.setAttribute("cy", s.head[1].toFixed(1));
}
