import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { GUIDE } from "./exercise-guide";
import { mobilityFor, strengthFor } from "./extras";
import { planFor } from "./plan";

describe("exercise guide", () => {
  it("every exercise scheduled from now to Tel Aviv has a drawing and a how-to in both languages", () => {
    const missing = new Set<string>();
    for (let d = "2026-11-02"; d <= "2027-02-26"; d = addDays(d, 1)) {
      for (const x of [strengthFor(d), mobilityFor(d, planFor(d, {}))]) {
        for (const e of x?.exercises ?? []) {
          const g = GUIDE[e.id];
          if (!g || !g.steps.length || !g.cue.he || !g.mistake.he || !g.fig.body.length) missing.add(e.id);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
