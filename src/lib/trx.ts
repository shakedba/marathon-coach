/**
 * TRX mini app: exercises (animated figure + how-to), sessions and the interval timeline.
 * Suggested doses follow the Tel Aviv outline phases; the approved strength schedule
 * in extras.ts is unchanged (TRX is not scheduled into plan days yet).
 */
import { diffDays, weekStart } from "./dates";
import { RACES, TLV_OUTLINE } from "./plan";
import type { Rig } from "./trx-figure";
import type { Text } from "./types";

const t = (en: string, he: string): Text => ({ en, he });

export type Area = "legs" | "upper" | "core";

export interface TrxExercise {
  name: Text;
  area: Area;
  target: Text;
  setup: Text; // strap length / position
  steps: Text[];
  cue: Text;
  mistake: Text;
  easier: Text;
  harder: Text;
  /** Done one side at a time (two work blocks). */
  perSide?: boolean;
  /** Static hold rather than reps. */
  hold?: boolean;
  rig: Rig;
}

const STAND = 119; // ankle height when the foot is on the floor

export const TRX: Record<string, TrxExercise> = {
  squat: {
    name: t("TRX squat", "סקוואט TRX"),
    area: "legs",
    target: t("Quads, glutes", "ארבע ראשי, ישבן"),
    setup: t("Straps mid-length. Face the anchor, arms straight.", "רצועות באורך בינוני. פנים לעוגן, ידיים ישרות."),
    steps: [
      t("Feet hip-width, hold the handles at chest height with straight arms.", "כפות רגליים ברוחב האגן, אוחזים בידיות בגובה החזה בידיים ישרות."),
      t("Sit back and down until the thighs are about parallel.", "יושבים אחורה ולמטה עד שהירכיים בערך מקבילות לרצפה."),
      t("Push the floor away and stand up. The straps are for balance, not for pulling.", "דוחפים את הרצפה ועולים. הרצועות לאיזון, לא למשיכה."),
    ],
    cue: t("Weight on the whole foot; knees over the toes.", "משקל על כל כף הרגל; ברכיים מעל האצבעות."),
    mistake: t("Pulling yourself up with the arms.", "למשוך את עצמך למעלה עם הידיים."),
    easier: t("Go less deep.", "לרדת פחות עמוק."),
    harder: t("3 s down, pause at the bottom.", "3 שניות ירידה, עצירה למטה."),
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [190, 4], strapTo: "hands",
      a: { hip: [80, 67], torso: 0, footN: [84, STAND], footF: [80, STAND], handN: [112, 46], handF: [110, 48] },
      b: { hip: [58, 96], torso: 28, footN: [84, STAND], footF: [80, STAND], handN: [112, 58], handF: [110, 60] },
    },
  },
  bulgarian: {
    name: t("Suspended lunge (Bulgarian)", "לאנג' תלוי (בולגרי)"),
    area: "legs",
    target: t("Glutes, quads, single-leg balance", "ישבן, ארבע ראשי, יציבות על רגל אחת"),
    setup: t("Straps long, both cradles joined at mid-calf height. Face away from the anchor.", "רצועות ארוכות, שתי העריסות מחוברות בגובה אמצע השוק. גב לעוגן."),
    steps: [
      t("Put the back foot in the cradle, hop forward so the front foot is well ahead.", "מכניסים את כף הרגל האחורית לעריסה ומקפצים קדימה כך שהרגל הקדמית רחוקה מספיק."),
      t("Lower straight down; the back knee drops toward the floor.", "יורדים ישר למטה; הברך האחורית יורדת לכיוון הרצפה."),
      t("Drive up through the front heel.", "עולים בדחיפה מעקב הרגל הקדמית."),
    ],
    cue: t("Front knee stays in line with the second toe.", "הברך הקדמית בקו עם האצבע השנייה."),
    mistake: t("Front knee collapsing inward.", "ברך קדמית שקורסת פנימה."),
    easier: t("Hold a wall or chair with one hand.", "להיאחז ביד אחת בקיר או בכיסא."),
    harder: t("Slow 3 s down; a small pause at the bottom.", "ירידה איטית של 3 שניות; עצירה קצרה למטה."),
    perSide: true,
    rig: {
      kneeN: -1, kneeF: -1, elbowN: -1, elbowF: -1, anchor: [24, 4], strapTo: "foot-far",
      a: { hip: [100, 67], torso: 6, footN: [120, STAND], footF: [66, 90], handN: [106, 70], handF: [104, 70], toeF: 160 },
      b: { hip: [96, 92], torso: 14, footN: [120, STAND], footF: [60, 100], handN: [104, 94], handF: [102, 94], toeF: 160 },
    },
  },
  "hamstring-curl": {
    name: t("Hamstring curl", "כפיפת ברך (ירך אחורית)"),
    area: "legs",
    target: t("Hamstrings, glutes", "ירך אחורית, ישבן"),
    setup: t("Straps at mid-calf height. Lie on your back, heels in the cradles under the anchor.", "רצועות בגובה אמצע השוק. שוכבים על הגב, עקבים בעריסות מתחת לעוגן."),
    steps: [
      t("Arms on the floor, lift the hips so the body is a straight line.", "ידיים על הרצפה, מרימים אגן לקו ישר."),
      t("Keep the hips high and pull the heels toward the glutes.", "משאירים אגן גבוה ומושכים את העקבים לישבן."),
      t("Straighten the legs slowly without dropping the hips.", "מיישרים רגליים לאט בלי להוריד את האגן."),
    ],
    cue: t("Hips stay up the whole time.", "האגן נשאר למעלה כל הזמן."),
    mistake: t("Hips sagging as the legs straighten.", "אגן שצונח כשהרגליים מתיישרות."),
    easier: t("Hip lift only (bridge with heels in the straps).", "רק הרמת אגן (גשר עם העקבים ברצועות)."),
    harder: t("One leg at a time.", "רגל אחת בכל פעם."),
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [150, 4], strapTo: "feet",
      a: { hip: [72, 101], torso: -108, head: -90, footN: [124, 94], footF: [122, 94], handN: [74, 119], handF: [72, 119], toeN: 20, toeF: 20 },
      b: { hip: [70, 96], torso: -116, head: -90, footN: [108, 100], footF: [106, 100], handN: [74, 119], handF: [72, 119], toeN: 50, toeF: 50 },
    },
  },
  "single-leg-squat": {
    name: t("Single-leg squat (assisted)", "סקוואט על רגל אחת (בעזרה)"),
    area: "legs",
    target: t("Glutes, quads, knee and ankle control", "ישבן, ארבע ראשי, שליטה בברך ובקרסול"),
    setup: t("Straps mid-length. Face the anchor, arms straight.", "רצועות באורך בינוני. פנים לעוגן, ידיים ישרות."),
    steps: [
      t("Stand on one leg, the other leg slightly forward off the floor.", "עומדים על רגל אחת, הרגל השנייה מעט קדימה באוויר."),
      t("Sit back as deep as you control, the free leg reaching forward.", "יושבים אחורה עמוק ככל שיש שליטה, הרגל החופשית נשלחת קדימה."),
      t("Stand up using the straps only as much as needed.", "עולים ונעזרים ברצועות רק כמה שצריך."),
    ],
    cue: t("Slow and controlled; the knee does not wobble.", "לאט ובשליטה; הברך לא מתנדנדת."),
    mistake: t("Dropping fast and bouncing up.", "נפילה מהירה וקפיצה למעלה."),
    easier: t("Go to a quarter depth.", "לרדת רק רבע."),
    harder: t("Less help from the arms.", "פחות עזרה מהידיים."),
    perSide: true,
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [190, 4], strapTo: "hands",
      a: { hip: [80, 67], torso: 0, footN: [82, STAND], footF: [96, 108], handN: [112, 46], handF: [110, 48], toeF: 120 },
      b: { hip: [60, 98], torso: 30, footN: [82, STAND], footF: [112, 100], handN: [114, 58], handF: [112, 60], toeF: 150 },
    },
  },
  row: {
    name: t("TRX row", "חתירה TRX"),
    area: "upper",
    target: t("Upper back, biceps, posture", "גב עליון, יד קדמית, יציבה"),
    setup: t("Straps short. Face the anchor, lean back with straight arms.", "רצועות קצרות. פנים לעוגן, נשענים לאחור בידיים ישרות."),
    steps: [
      t("Body straight from heels to head, arms straight.", "גוף ישר מהעקבים לראש, ידיים ישרות."),
      t("Pull the chest up to the handles, elbows close to the body.", "מושכים את החזה לידיות, מרפקים צמודים לגוף."),
      t("Lower slowly back to straight arms.", "יורדים לאט חזרה לידיים ישרות."),
    ],
    cue: t("Squeeze the shoulder blades together at the top.", "לכווץ את השכמות זו לזו למעלה."),
    mistake: t("Hips sagging; shrugging the shoulders.", "אגן שצונח; כתפיים שעולות לאוזניים."),
    easier: t("Step back (more upright).", "לצעוד אחורה (גוף זקוף יותר)."),
    harder: t("Walk the feet toward the anchor (more lean).", "לקדם את הרגליים לכיוון העוגן (יותר הטיה)."),
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [190, 4], strapTo: "hands",
      a: { hip: [83, 76.5], torso: -35, footN: [114, STAND], footF: [110, STAND], handN: [97, 35], handF: [95, 36] },
      b: { hip: [92, 72], torso: -22, footN: [114, STAND], footF: [110, STAND], handN: [84, 54], handF: [82, 55] },
    },
  },
  "chest-press": {
    name: t("Chest press", "לחיצת חזה"),
    area: "upper",
    target: t("Chest, shoulders, triceps, core", "חזה, כתפיים, יד אחורית, ליבה"),
    setup: t("Straps mid-length. Face away from the anchor, lean forward on straight arms.", "רצועות באורך בינוני. גב לעוגן, נשענים קדימה על ידיים ישרות."),
    steps: [
      t("Body straight, arms in front at chest height.", "גוף ישר, ידיים קדימה בגובה החזה."),
      t("Bend the elbows and lower the chest between the handles.", "מכופפים מרפקים ומורידים את החזה בין הידיות."),
      t("Press back to straight arms, like a standing push-up.", "דוחפים חזרה לידיים ישרות, כמו שכיבת סמיכה בעמידה."),
    ],
    cue: t("Plank the whole body: glutes and belly tight.", "כל הגוף בפלאנק: ישבן ובטן מכווצים."),
    mistake: t("Hips sagging or the straps rubbing the arms.", "אגן שצונח או רצועות שמשפשפות את הידיים."),
    easier: t("Step the feet back (more upright).", "לצעוד אחורה (זקוף יותר)."),
    harder: t("Walk the feet back further from the anchor (more lean).", "להרחיק את הרגליים מהעוגן (יותר הטיה)."),
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [20, 4], strapTo: "hands",
      a: { hip: [104, 74], torso: 30, footN: [80, STAND], footF: [76, STAND], handN: [154, 58], handF: [152, 60] },
      b: { hip: [113, 80], torso: 44, footN: [80, STAND], footF: [76, STAND], handN: [146, 70], handF: [144, 72] },
    },
  },
  "y-fly": {
    name: t("Y-fly", "Y-fly (הרמת ידיים ל-Y)"),
    area: "upper",
    target: t("Rear shoulders, upper back, posture", "כתף אחורית, גב עליון, יציבה"),
    setup: t("Straps short. Face the anchor, lean back a little.", "רצועות קצרות. פנים לעוגן, נשענים מעט לאחור."),
    steps: [
      t("Start like a row with straight arms.", "מתחילים כמו חתירה בידיים ישרות."),
      t("Keep the arms straight and raise them up and out into a Y.", "בידיים ישרות מרימים אותן למעלה ולצדדים בצורת Y."),
      t("Lower slowly.", "יורדים לאט."),
    ],
    cue: t("Thumbs up; the move comes from the shoulder blades.", "אגודלים למעלה; התנועה מהשכמות."),
    mistake: t("Bending the elbows or arching the lower back.", "כיפוף מרפקים או קשת בגב התחתון."),
    easier: t("Stand more upright.", "לעמוד זקוף יותר."),
    harder: t("Lean back more; pause at the top.", "להטות יותר; עצירה למעלה."),
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [190, 4], strapTo: "hands",
      a: { hip: [86, 74], torso: -28, footN: [114, STAND], footF: [110, STAND], handN: [104, 31], handF: [102, 32] },
      b: { hip: [94, 70], torso: -16, footN: [114, STAND], footF: [110, STAND], handN: [106, 3], handF: [104, 4] },
    },
  },
  plank: {
    name: t("Plank, feet in the straps", "פלאנק, רגליים ברצועות"),
    area: "core",
    target: t("Deep core, shoulders", "ליבה עמוקה, כתפיים"),
    setup: t("Straps at mid-calf height. Feet in the cradles, forearms on the floor under the shoulders.", "רצועות בגובה אמצע השוק. כפות רגליים בעריסות, אמות על הרצפה מתחת לכתפיים."),
    steps: [
      t("Lift the knees so the body is a straight line.", "מרימים ברכיים כך שהגוף בקו ישר."),
      t("Hold and breathe; the straps must not swing.", "מחזיקים ונושמים; הרצועות לא מתנדנדות."),
    ],
    cue: t("Belly button in, glutes tight.", "טבור פנימה, ישבן מכווץ."),
    mistake: t("Hips too high or sagging.", "אגן גבוה מדי או צונח."),
    easier: t("Feet on the floor.", "רגליים על הרצפה."),
    harder: t("On the hands instead of the forearms.", "על כפות הידיים במקום האמות."),
    hold: true,
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [30, 4], strapTo: "feet",
      a: { hip: [92, 99], torso: 90, footN: [39, 99], footF: [38, 99], handN: [146, 119], handF: [144, 119], toeN: 0, toeF: 0 },
    },
  },
  "knee-tuck": {
    name: t("Knee tuck", "משיכת ברכיים לחזה"),
    area: "core",
    target: t("Abs, hip flexors, shoulders", "בטן, כופפי ירך, כתפיים"),
    setup: t("Straps at mid-calf height. Feet in the cradles, hands on the floor (high plank).", "רצועות בגובה אמצע השוק. כפות רגליים בעריסות, ידיים על הרצפה (פלאנק גבוה)."),
    steps: [
      t("Start in a straight high plank, hands under the shoulders.", "מתחילים בפלאנק גבוה וישר, ידיים מתחת לכתפיים."),
      t("Pull both knees toward the chest.", "מושכים את שתי הברכיים לחזה."),
      t("Straighten back to the plank slowly.", "חוזרים לאט לפלאנק ישר."),
    ],
    cue: t("Shoulders stay over the hands.", "הכתפיים נשארות מעל הידיים."),
    mistake: t("Rushing so the straps swing.", "לעשות מהר כך שהרצועות מתנדנדות."),
    easier: t("Plank hold only.", "רק להחזיק פלאנק."),
    harder: t("Pike: lift the hips high instead of bending the knees.", "פייק: להרים אגן גבוה במקום לכופף ברכיים."),
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [40, 4], strapTo: "feet",
      a: { hip: [104, 88], torso: 81, footN: [54, 96], footF: [52, 96], handN: [142, 119], handF: [140, 119], toeN: 0, toeF: 0 },
      b: { hip: [106, 74], torso: 104, footN: [84, 94], footF: [82, 94], handN: [142, 119], handF: [140, 119], toeN: 10, toeF: 10 },
    },
  },
  "side-plank": {
    name: t("Side plank, feet in the straps", "פלאנק צד, רגליים ברצועות"),
    area: "core",
    target: t("Side core, glute medius (hip stability when running)", "ליבה צידית, ישבן אמצעי (יציבות אגן בריצה)"),
    setup: t("Straps at mid-calf height. Lie on your side, feet stacked in the cradles, elbow under the shoulder.", "רצועות בגובה אמצע השוק. שוכבים על הצד, כפות רגליים אחת על השנייה בעריסות, מרפק מתחת לכתף."),
    steps: [
      t("Lift the hips so the body is straight from head to feet.", "מרימים אגן כך שהגוף ישר מהראש לרגליים."),
      t("Top arm up to the ceiling. Hold and breathe.", "יד עליונה לתקרה. מחזיקים ונושמים."),
    ],
    cue: t("Push the floor away with the forearm; hips forward.", "דוחפים את הרצפה עם האמה; אגן קדימה."),
    mistake: t("Hips dropping or rolling backward.", "אגן שצונח או מתגלגל אחורה."),
    easier: t("Feet on the floor, or bottom knee down.", "רגליים על הרצפה, או ברך תחתונה על הרצפה."),
    harder: t("Slow hip dips: lower 5 cm, lift.", "הורדות אגן איטיות: 5 ס\"מ למטה ולמעלה."),
    perSide: true,
    hold: true,
    rig: {
      kneeN: -1, kneeF: -1, elbowN: 1, elbowF: 1, anchor: [30, 4], strapTo: "feet",
      a: { hip: [92, 104], torso: 80, head: 80, footN: [39, 107], footF: [39, 103], handN: [146, 119], handF: [130, 60], toeN: 0, toeF: 0 },
    },
  },
};

// ---------- sessions ----------

export interface Session {
  id: "full" | "light" | "upper";
  name: Text;
  sub: Text;
  exercises: string[];
  rounds: number;
}

export const SESSIONS: Session[] = [
  {
    id: "full",
    name: t("Full body", "כל הגוף"),
    sub: t("Legs, upper body and core. Build weeks.", "רגליים, פלג גוף עליון וליבה. שבועות בנייה."),
    exercises: ["squat", "row", "bulgarian", "chest-press", "hamstring-curl", "y-fly", "single-leg-squat", "plank", "knee-tuck", "side-plank"],
    rounds: 3,
  },
  {
    id: "light",
    name: t("Light", "קל"),
    sub: t("Recovery, cutback and taper weeks.", "שבועות התאוששות, הורדה וטייפר."),
    exercises: ["squat", "row", "hamstring-curl", "chest-press", "plank", "side-plank"],
    rounds: 2,
  },
  {
    id: "upper",
    name: t("Upper body + core", "פלג גוף עליון + ליבה"),
    sub: t("No legs: the day before a long run or with a leg niggle.", "בלי רגליים: יום לפני ריצה ארוכה או עם כאב ברגל."),
    exercises: ["row", "chest-press", "y-fly", "plank", "knee-tuck", "side-plank"],
    rounds: 2,
  },
];

export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id);

// ---------- timer timeline ----------

export interface Settings {
  rounds: number;
  work: number; // seconds per exercise (per side: `sideWork`)
  rest: number; // seconds between exercises
  roundRest: number; // seconds between rounds
}

export const DEFAULTS: Settings = { rounds: 3, work: 40, rest: 20, roundRest: 90 };
export const PREP = 10;
export const SWITCH = 8;
/** Per-side blocks are shorter so a round doesn't drag. */
export const sideWork = (work: number) => Math.max(20, work - 10);

export type BlockKind = "prep" | "work" | "rest" | "switch" | "round-rest";

export interface Block {
  kind: BlockKind;
  sec: number;
  round: number; // 1-based
  ex: string; // exercise being done, or the next one during prep/rest
  side?: 1 | 2;
}

export function timeline(s: Session, set: Settings): Block[] {
  const out: Block[] = [{ kind: "prep", sec: PREP, round: 1, ex: s.exercises[0] }];
  for (let r = 1; r <= set.rounds; r++) {
    s.exercises.forEach((id, i) => {
      const e = TRX[id];
      if (e.perSide) {
        const w = sideWork(set.work);
        out.push({ kind: "work", sec: w, round: r, ex: id, side: 1 });
        out.push({ kind: "switch", sec: SWITCH, round: r, ex: id, side: 2 });
        out.push({ kind: "work", sec: w, round: r, ex: id, side: 2 });
      } else {
        out.push({ kind: "work", sec: set.work, round: r, ex: id });
      }
      const last = i === s.exercises.length - 1;
      if (!last) out.push({ kind: "rest", sec: set.rest, round: r, ex: s.exercises[i + 1] });
      else if (r < set.rounds) out.push({ kind: "round-rest", sec: set.roundRest, round: r, ex: s.exercises[0] });
    });
  }
  return out;
}

export const totalSec = (blocks: Block[]) => blocks.reduce((a, b) => a + b.sec, 0);

// ---------- what to do this week ----------

export interface Advice {
  session: Session["id"] | null;
  perWeek: number;
  rounds: number;
  why: Text;
}

/** Suggested TRX dose for a date, from the Tel Aviv outline phase. */
export function adviceFor(date: string): Advice {
  const race = RACES.find((r) => {
    const d = diffDays(r.date, date);
    return d >= 0 && d < 10;
  });
  if (race) return { session: null, perWeek: 0, rounds: 0, why: t("Last 10 days before a race: no strength work.", "10 הימים האחרונים לפני מרוץ: בלי חיזוקים.") };
  const ws = weekStart(date);
  const week = TLV_OUTLINE.find((w) => w.weekStart === ws);
  const phase = week?.phase.en ?? "";
  if (phase === "Recovery") return { session: "light", perWeek: 2, rounds: 2, why: t("Recovery after Haifa: light, finish fresh.", "התאוששות אחרי חיפה: קל, לסיים רענן.") };
  if (phase === "Cutback" || phase === "Taper") return { session: "light", perWeek: 1, rounds: 2, why: t(`${phase} week: once, light.`, `שבוע ${week!.phase.he}: פעם אחת, קל.`) };
  if (phase === "Race") return { session: null, perWeek: 0, rounds: 0, why: t("Race week: rest.", "שבוע המרוץ: מנוחה.") };
  if (phase === "Return") return { session: "full", perWeek: 2, rounds: 2, why: t("Back to training: full body, 2 rounds.", "חזרה לאימונים: כל הגוף, 2 סבבים.") };
  if (week) return { session: "full", perWeek: 2, rounds: 3, why: t(`${week.phase.en} week: full body twice, after easy runs.`, `שבוע ${week.phase.he}: כל הגוף פעמיים, אחרי ריצות קלות.`) };
  return { session: "full", perWeek: 2, rounds: 2, why: t("Twice a week after easy runs.", "פעמיים בשבוע אחרי ריצות קלות.") };
}
