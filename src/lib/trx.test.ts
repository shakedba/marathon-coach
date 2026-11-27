import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { DEFAULTS, PREP, SESSIONS, SWITCH, TRX, adviceFor, sideWork, timeline, totalSec } from "./trx";
import { FLOOR, LEN, lerpPose, repPhase, skeleton, solve, type Pt } from "./trx-figure";

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("TRX figure", () => {
  it("IK keeps limb lengths", () => {
    for (const target of [[10, 40], [5, 5], [100, 0], [0, 0.5]] as Pt[]) {
      const { joint, end } = solve([0, 0], target, LEN.thigh, LEN.shin, 1);
      expect(dist([0, 0], joint)).toBeCloseTo(LEN.thigh, 5);
      expect(dist(joint, end)).toBeCloseTo(LEN.shin, 5);
    }
  });

  it("every pose of every exercise stays in the box and above the floor", () => {
    const bad: string[] = [];
    for (const [id, e] of Object.entries(TRX)) {
      const poses = e.rig.b ? [0, 0.25, 0.5, 0.75, 1].map((t) => lerpPose(e.rig.a, e.rig.b!, t)) : [e.rig.a];
      for (const p of poses) {
        const s = skeleton(p, e.rig);
        const all = [s.head, s.neck, s.hip, ...s.near.leg, ...s.near.arm, ...s.far.leg, ...s.far.arm];
        if (all.some(([x, y]) => x < 0 || x > 200 || y < 0 || y > FLOOR + 1)) bad.push(id);
        if (s.head[1] + LEN.headR > FLOOR + 1) bad.push(`${id}: head under the floor`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it("standing feet stay planted through the movement", () => {
    for (const id of ["squat", "row", "chest-press", "y-fly"]) {
      const e = TRX[id];
      const a = skeleton(e.rig.a, e.rig).near.leg[2];
      const b = skeleton(e.rig.b!, e.rig).near.leg[2];
      expect(dist(a, b), id).toBeLessThan(0.5);
    }
  });

  it("a rep holds at both ends", () => {
    expect(repPhase(0)).toBe(0);
    expect(repPhase(1600 + 100)).toBe(1);
    expect(repPhase(3200)).toBe(0);
  });
});

describe("TRX content", () => {
  it("every exercise has a full how-to in both languages", () => {
    for (const [id, e] of Object.entries(TRX)) {
      for (const x of [e.name, e.target, e.setup, e.cue, e.mistake, e.easier, e.harder, ...e.steps]) {
        expect(x.he.length, id).toBeGreaterThan(1);
        expect(x.en.length, id).toBeGreaterThan(1);
      }
      expect(e.rig.b || e.hold, `${id}: needs a movement or be a hold`).toBeTruthy();
    }
  });

  it("sessions only use known exercises; upper body session has no leg work", () => {
    for (const s of SESSIONS) for (const id of s.exercises) expect(TRX[id], id).toBeDefined();
    const upper = SESSIONS.find((s) => s.id === "upper")!;
    expect(upper.exercises.filter((id) => TRX[id].area === "legs")).toEqual([]);
  });
});

describe("timer timeline", () => {
  const light = SESSIONS.find((s) => s.id === "light")!;

  it("prep, then work/rest per exercise, both sides for one-side exercises, round rest between rounds only", () => {
    const set = { ...DEFAULTS, rounds: 2 };
    const b = timeline(light, set);
    expect(b[0]).toMatchObject({ kind: "prep", sec: PREP, ex: "squat" });
    const work = b.filter((x) => x.kind === "work");
    // 6 exercises, side plank twice, 2 rounds
    expect(work).toHaveLength(14);
    expect(b.filter((x) => x.kind === "switch")).toHaveLength(2);
    expect(b.filter((x) => x.kind === "round-rest")).toHaveLength(1);
    expect(b[b.length - 1]).toMatchObject({ kind: "work", ex: "side-plank", side: 2, round: 2 });
    const sides = b.filter((x) => x.ex === "side-plank" && x.kind === "work");
    expect(sides.every((x) => x.sec === sideWork(set.work))).toBe(true);
    // rest blocks name the next exercise
    const firstRest = b.find((x) => x.kind === "rest")!;
    expect(firstRest.ex).toBe("row");
  });

  it("total time adds up", () => {
    const set = { rounds: 1, work: 40, rest: 20, roundRest: 90 };
    // 5 x 40 + 2 x 30 (side plank) + switch + 5 rests + prep
    expect(totalSec(timeline(light, set))).toBe(PREP + 5 * 40 + 2 * 30 + SWITCH + 5 * 20);
  });
});

describe("weekly advice follows the Tel Aviv outline", () => {
  it("recovery: light twice", () => expect(adviceFor("2026-12-01")).toMatchObject({ session: "light", perWeek: 2 }));
  it("build: full body, 3 rounds", () => expect(adviceFor("2026-12-22")).toMatchObject({ session: "full", perWeek: 2, rounds: 3 }));
  it("cutback and taper: once, light", () => {
    expect(adviceFor("2027-01-12")).toMatchObject({ session: "light", perWeek: 1 });
    expect(adviceFor("2027-02-09")).toMatchObject({ session: "light", perWeek: 1 });
  });
  it("nothing in the last 10 days before Tel Aviv", () => {
    for (let d = addDays("2027-02-26", -9); d <= "2027-02-26"; d = addDays(d, 1)) expect(adviceFor(d).session).toBeNull();
  });
});

describe("TRX as an alternative to planned strength", () => {
  it("every planned strength day from now to Tel Aviv offers a TRX alternative of the right kind", async () => {
    const { strengthFor } = await import("./extras");
    const { trxAlternative } = await import("./trx");
    let n = 0;
    for (let d = "2026-11-30"; d <= "2027-02-26"; d = addDays(d, 1)) {
      const x = strengthFor(d);
      if (!x) continue;
      n++;
      const alt = trxAlternative(x)!;
      expect(alt, d).not.toBeNull();
      if (x.id === "C") expect(alt.session).toBe("upper"); // C must not fatigue the legs
      if (x.id.startsWith("A")) expect(alt.session).toBe("light");
      if (x.id.startsWith("B")) expect(alt.session).toBe("full");
      expect(alt.rounds).toBeGreaterThanOrEqual(1);
      expect(alt.rounds).toBeLessThanOrEqual(3);
    }
    expect(n).toBeGreaterThan(20);
  });

  it("B in a taper week gets the shorter full-body version", async () => {
    const { strengthFor } = await import("./extras");
    const { trxAlternative } = await import("./trx");
    expect(trxAlternative(strengthFor("2027-02-09")!)).toEqual({ session: "full", rounds: 2 });
    expect(trxAlternative(strengthFor("2026-12-22")!)).toEqual({ session: "full", rounds: 3 });
  });

  it("no scheduled exercise needs a mini band (the athlete has none)", async () => {
    const { strengthFor } = await import("./extras");
    const { GUIDE } = await import("./exercise-guide");
    for (let d = "2026-11-30"; d <= "2027-02-26"; d = addDays(d, 1)) {
      for (const e of strengthFor(d)?.exercises ?? []) {
        expect(GUIDE[e.id].fig.band, e.id).toBeUndefined();
        expect(e.name.en.replace("(no band)", ""), e.id).not.toMatch(/\bband\b/i);
      }
    }
  });
});

describe("own workout and rounds", () => {
  it("custom session keeps the chosen order and drops unknown or repeated ids", async () => {
    const { customSession } = await import("./trx");
    const s = customSession(["row", "nope", "squat", "row", 5, "plank"], 3);
    expect(s).toMatchObject({ id: "custom", exercises: ["row", "squat", "plank"], rounds: 3 });
    expect(customSession("garbage").exercises).toEqual([]);
  });

  it("an empty custom workout has no timeline", async () => {
    const { customSession } = await import("./trx");
    expect(timeline(customSession([]), DEFAULTS)).toEqual([]);
  });

  it("round rest names the round that is about to start, and every round has a spoken ordinal", async () => {
    const { customSession, ROUND_WORD } = await import("./trx");
    const b = timeline(customSession(["squat", "row"], 3), { ...DEFAULTS, rounds: 3 });
    const rr = b.filter((x) => x.kind === "round-rest");
    expect(rr.map((x) => x.round)).toEqual([2, 3]);
    expect(rr.every((x) => x.ex === "squat")).toBe(true);
    expect(ROUND_WORD.length).toBeGreaterThanOrEqual(3);
  });
});
