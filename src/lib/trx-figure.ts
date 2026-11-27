/**
 * Animated stick figure for the TRX app.
 *
 * A pose says where the hips, hands and feet are; elbows and knees are solved
 * with two-bone IK, so limbs keep their length while the figure moves between
 * two poses. Side view, 200 x 130 box, floor at y = 122, figure faces right.
 */

export type Pt = [number, number];

/** Which way a joint bends: +1 / -1 (screen-space rotation sign). */
export type Bend = 1 | -1;

export interface Pose {
  hip: Pt;
  /** Torso direction, degrees: 0 = straight up, 90 = towards +x, -90 = towards -x. */
  torso: number;
  /** Head direction from the shoulder, degrees as `torso` (defaults to `torso`). */
  head?: number;
  /** Near (n) and far (f) limbs: target points for ankles and wrists. */
  footN: Pt; footF: Pt;
  handN: Pt; handF: Pt;
  /** Foot direction, degrees from straight down (90 = toes towards +x). Default 90. */
  toeN?: number; toeF?: number;
}

export interface Rig {
  /** Joint bend directions. */
  kneeN: Bend; kneeF: Bend; elbowN: Bend; elbowF: Bend;
  /** Where the strap is attached and what it holds. */
  anchor: Pt;
  strapTo: "hands" | "feet" | "foot-far";
  /** Starting pose and the other end of the movement. A hold has only `a`. */
  a: Pose;
  b?: Pose;
}

export const LEN = { torso: 36, neck: 6, headR: 7, thigh: 27, shin: 26, foot: 9, upper: 19, fore: 18 } as const;
export const FLOOR = 122;

const rad = (d: number) => (d * Math.PI) / 180;

/** Two-bone IK: joint position between root and target (target clamped to reach). */
export function solve(root: Pt, target: Pt, l1: number, l2: number, bend: Bend): { joint: Pt; end: Pt } {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const raw = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(Math.max(raw, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const phi = Math.atan2(dy, dx);
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const a = phi + bend * alpha;
  const joint: Pt = [root[0] + l1 * Math.cos(a), root[1] + l1 * Math.sin(a)];
  const end: Pt = [root[0] + d * Math.cos(phi), root[1] + d * Math.sin(phi)];
  return { joint, end };
}

const dirUp = (deg: number, len: number): Pt => [Math.sin(rad(deg)) * len, -Math.cos(rad(deg)) * len];
const dirDown = (deg: number, len: number): Pt => [Math.sin(rad(deg)) * len, Math.cos(rad(deg)) * len];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

export interface Skeleton {
  head: Pt;
  neck: Pt;
  hip: Pt;
  near: { leg: Pt[]; arm: Pt[] };
  far: { leg: Pt[]; arm: Pt[] };
}

export function skeleton(p: Pose, r: Rig): Skeleton {
  const shoulder = add(p.hip, dirUp(p.torso, LEN.torso));
  const head = add(shoulder, dirUp(p.head ?? p.torso, LEN.neck + LEN.headR));
  const leg = (foot: Pt, bend: Bend, toe = 90): Pt[] => {
    const { joint, end } = solve(p.hip, foot, LEN.thigh, LEN.shin, bend);
    return [p.hip, joint, end, add(end, dirDown(toe, LEN.foot))];
  };
  const arm = (hand: Pt, bend: Bend): Pt[] => {
    const { joint, end } = solve(shoulder, hand, LEN.upper, LEN.fore, bend);
    return [shoulder, joint, end];
  };
  return {
    head,
    neck: shoulder,
    hip: p.hip,
    near: { leg: leg(p.footN, r.kneeN, p.toeN), arm: arm(p.handN, r.elbowN) },
    far: { leg: leg(p.footF, r.kneeF, p.toeF), arm: arm(p.handF, r.elbowF) },
  };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPt = (a: Pt, b: Pt, t: number): Pt => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

/** Pose between a (t = 0) and b (t = 1). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: mixPt(a.hip, b.hip, t),
    torso: mix(a.torso, b.torso, t),
    head: mix(a.head ?? a.torso, b.head ?? b.torso, t),
    footN: mixPt(a.footN, b.footN, t), footF: mixPt(a.footF, b.footF, t),
    handN: mixPt(a.handN, b.handN, t), handF: mixPt(a.handF, b.handF, t),
    toeN: mix(a.toeN ?? 90, b.toeN ?? 90, t), toeF: mix(a.toeF ?? 90, b.toeF ?? 90, t),
  };
}

/** One rep: hold at the start, slow out, short hold, back. Returns 0..1 for a time in ms. */
export function repPhase(ms: number, periodMs = 3200): number {
  const x = (ms % periodMs) / periodMs;
  const hold = 0.12;
  if (x < hold) return 0;
  if (x < 0.5) return ease((x - hold) / (0.5 - hold));
  if (x < 0.5 + hold) return 1;
  return 1 - ease((x - 0.5 - hold) / (0.5 - hold));
}
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

export const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** Strap end points for a pose (anchor -> what it holds). */
export function strapLines(s: Skeleton, r: Rig): Pt[][] {
  const end = (limb: Pt[], i: number) => limb[i];
  if (r.strapTo === "hands") return [[r.anchor, end(s.far.arm, 2)], [r.anchor, end(s.near.arm, 2)]];
  if (r.strapTo === "foot-far") return [[r.anchor, end(s.far.leg, 2)]];
  return [[r.anchor, end(s.far.leg, 2)], [r.anchor, end(s.near.leg, 2)]];
}
