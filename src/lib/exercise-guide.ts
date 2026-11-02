/**
 * How-to for every strength / mobility exercise in the program, with a simple
 * stick-figure drawing (side view, 160x100 box, floor at y=92).
 */
import type { Text } from "./types";

export interface Figure {
  head: [number, number];
  /** Body segments as SVG polyline point lists ("x,y x,y ..."). */
  body: string[];
  wall?: number;
  bench?: [number, number, number, number]; // x, y, w, h
  bar?: [number, number, number]; // x1, x2, y
  db?: [number, number][]; // dumbbell centres
  band?: string; // polyline, drawn dashed in accent colour
  strap?: string;
  arrow?: string; // SVG path, drawn in accent colour with arrowhead
  noFloor?: boolean;
}

export interface Guide {
  name: Text;
  target: Text; // what it strengthens / stretches
  steps: Text[];
  cue: Text; // the one thing to focus on
  mistake: Text; // the common error
  fig: Figure;
}

const t = (en: string, he: string): Text => ({ en, he });

export const GUIDE: Record<string, Guide> = {
  squat: {
    name: t("Bodyweight squat", "סקוואט במשקל גוף"),
    target: t("Quads, glutes", "ארבע ראשי, ישבן"),
    steps: [
      t("Feet hip-width, toes slightly out.", "כפות רגליים ברוחב האגן, אצבעות מעט החוצה."),
      t("Sit back and down as if onto a chair, arms forward for balance.", "לשבת אחורה ולמטה כאילו לכיסא, ידיים קדימה לאיזון."),
      t("Go down until thighs are about parallel, then push up through the whole foot.", "לרדת עד שהירכיים בערך מקבילות לרצפה ולעלות בדחיפה מכל כף הרגל."),
    ],
    cue: t("Knees track over the toes; chest up.", "הברכיים בכיוון האצבעות, החזה פתוח."),
    mistake: t("Knees collapsing inward or heels lifting.", "ברכיים שקורסות פנימה או עקבים שמתרוממים."),
    fig: { head: [80, 37], body: ["76,45 60,64", "60,64 82,68 78,92 90,92", "77,48 104,50"], arrow: "M120 40 L120 70" },
  },
  "reverse-lunge": {
    name: t("Reverse lunge", "לאנג' אחורי"),
    target: t("Glutes, quads, balance", "ישבן, ארבע ראשי, יציבות"),
    steps: [
      t("Stand tall, hands on hips.", "לעמוד זקוף, ידיים על המותניים."),
      t("Step one foot back and lower until both knees are about 90°.", "לצעוד רגל אחת אחורה ולרדת עד ששתי הברכיים בערך ב-90°."),
      t("Push through the front heel to return. Alternate legs.", "לדחוף מעקב הרגל הקדמית לחזור. להחליף רגליים."),
    ],
    cue: t("Torso upright, front knee stays over the ankle.", "גו זקוף, הברך הקדמית מעל הקרסול."),
    mistake: t("Back knee slamming the floor; leaning forward.", "ברך אחורית שנוחתת חזק על הרצפה; הטיה קדימה."),
    fig: { head: [80, 24], body: ["80,31 80,58", "80,58 98,72 98,92", "80,58 68,86 54,90", "80,36 88,48 81,56"], arrow: "M60 70 L40 70" },
  },
  "glute-bridge": {
    name: t("Glute bridge", "גשר ישבן"),
    target: t("Glutes, hamstrings", "ישבן, ירך אחורית"),
    steps: [
      t("Lie on your back, knees bent, feet flat, arms by your sides.", "לשכב על הגב, ברכיים כפופות, כפות רגליים על הרצפה, ידיים לצד הגוף."),
      t("Squeeze the glutes and lift hips until knees-hips-shoulders form a line.", "לכווץ ישבן ולהרים אגן עד קו ישר ברכיים-אגן-כתפיים."),
      t("Hold 1-2 s, lower slowly. Easy? Do it on one leg.", "להחזיק 1-2 שנ', לרדת לאט. קל? על רגל אחת."),
    ],
    cue: t("Push through the heels; feel it in the glutes, not the lower back.", "לדחוף דרך העקבים; להרגיש בישבן, לא בגב התחתון."),
    mistake: t("Arching the lower back instead of using the glutes.", "קשת בגב התחתון במקום עבודת ישבן."),
    fig: { head: [20, 85], body: ["28,88 70,72", "70,72 96,64 100,92", "30,90 60,91"], arrow: "M70 92 L70 78" },
  },
  "calf-raise": {
    name: t("Calf raise", "הרמות עקב"),
    target: t("Calves, Achilles", "שוקיים, גיד אכילס"),
    steps: [
      t("Stand on the edge of a step (or flat), light hand on a wall.", "לעמוד על קצה מדרגה (או על הרצפה), יד קלה על הקיר."),
      t("Rise onto the toes over 2 s, lower over 3 s.", "לעלות על קצות האצבעות ב-2 שנ', לרדת ב-3 שנ'."),
      t("Repeat with knees slightly bent (works the deeper calf muscle). Single-leg + dumbbell from December.", "לחזור עם ברכיים מעט כפופות (עובד על שריר השוק העמוק). מדצמבר: על רגל אחת עם משקולת."),
    ],
    cue: t("Slow down, full range: high on the toes, heel low.", "לאט, טווח מלא: גבוה על האצבעות, עקב נמוך."),
    mistake: t("Bouncing fast; rolling onto the outer foot.", "קפיצות מהירות; גלגול לצד החיצוני של כף הרגל."),
    fig: { head: [80, 17], body: ["80,24 80,52", "80,52 81,72 84,86 92,91", "80,29 100,40"], wall: 104, arrow: "M60 80 L60 60" },
  },
  "side-plank": {
    name: t("Side plank", "פלאנק צד"),
    target: t("Side core, hip stabilisers", "שרירי צד הבטן, מייצבי אגן"),
    steps: [
      t("Lie on your side, elbow under the shoulder, legs straight and stacked.", "לשכב על הצד, מרפק מתחת לכתף, רגליים ישרות אחת על השנייה."),
      t("Lift the hips so the body is a straight line from head to feet.", "להרים את האגן כך שהגוף קו ישר מהראש לרגליים."),
      t("Hold, breathing normally. Switch sides.", "להחזיק ולנשום רגיל. להחליף צד."),
    ],
    cue: t("Hips high and forward, not sagging or behind.", "אגן גבוה וקדימה, לא שוקע ולא נשאר מאחור."),
    mistake: t("Hips dropping toward the floor.", "אגן שצונח לכיוון הרצפה."),
    fig: { head: [34, 62], body: ["40,70 132,90", "40,70 40,90 58,90"] },
  },
  "dead-bug": {
    name: t("Dead bug", "Dead bug"),
    target: t("Deep core (keeps the pelvis stable when you run)", "בטן עמוקה (מייצבת את האגן בריצה)"),
    steps: [
      t("Lie on your back, arms up to the ceiling, hips and knees at 90°.", "לשכב על הגב, ידיים לתקרה, אגן וברכיים ב-90°."),
      t("Press the lower back into the floor.", "להצמיד את הגב התחתון לרצפה."),
      t("Slowly lower one arm overhead and the opposite leg toward the floor, return, switch.", "להוריד לאט יד אחת מעל הראש ואת הרגל הנגדית לכיוון הרצפה, לחזור ולהחליף."),
    ],
    cue: t("Lower back never leaves the floor; breathe out as you extend.", "הגב התחתון לא עוזב את הרצפה; נשיפה בזמן הפשיטה."),
    mistake: t("Moving fast; the back arching off the floor.", "תנועה מהירה; גב שמתקשת מהרצפה."),
    fig: { head: [28, 82], body: ["36,86 78,86", "42,84 42,58", "42,84 18,70", "78,86 78,64 100,64", "78,86 128,80"], arrow: "M136 70 L136 84" },
  },
  clamshell: {
    name: t("Clamshell with band", "Clamshell עם גומייה"),
    target: t("Glute medius (knee and hip control)", "ישבן אמצעי (שליטה בברך ובאגן)"),
    steps: [
      t("Lie on your side, band just above the knees, knees bent ~45°, heels together.", "לשכב על הצד, גומייה מעל הברכיים, ברכיים כפופות ~45°, עקבים צמודים."),
      t("Keeping the feet together, open the top knee like a clamshell.", "בלי להפריד את כפות הרגליים, לפתוח את הברך העליונה כמו צדפה."),
      t("Pause, close slowly.", "עצירה קצרה, לסגור לאט."),
    ],
    cue: t("Hips stacked; don't roll backward.", "האגן מאונך לרצפה; לא להתגלגל אחורה."),
    mistake: t("Rolling the pelvis back to fake the range.", "גלגול האגן אחורה כדי 'להרוויח' טווח."),
    fig: { head: [24, 76], body: ["32,82 76,84", "76,84 100,88 82,91", "76,84 98,66 82,89", "30,80 46,72"], band: "98,70 100,86", arrow: "M108 82 Q112 70 104 62" },
  },
  "bird-dog": {
    name: t("Bird dog", "Bird dog"),
    target: t("Core, glutes, back stability", "בטן, ישבן, יציבות גב"),
    steps: [
      t("On hands and knees: hands under shoulders, knees under hips.", "על הידיים והברכיים: ידיים מתחת לכתפיים, ברכיים מתחת לאגן."),
      t("Extend one arm forward and the opposite leg back until level with the body.", "לשלוח יד אחת קדימה ואת הרגל הנגדית אחורה עד קו הגוף."),
      t("Hold 2 s, return, switch.", "להחזיק 2 שנ', לחזור ולהחליף."),
    ],
    cue: t("Hips stay level, as if a glass of water sits on your back.", "האגן נשאר ישר, כאילו יש כוס מים על הגב."),
    mistake: t("Twisting the hips or lifting the leg too high.", "סיבוב האגן או הרמת הרגל גבוה מדי."),
    fig: { head: [37, 60], body: ["45,66 95,66", "45,66 45,92", "95,66 95,92 118,92", "45,66 15,61", "95,66 140,64"] },
  },
  "monster-walk": {
    name: t("Band monster walk", "הליכת מפלצת עם גומייה"),
    target: t("Glute medius, hip stability", "ישבן אמצעי, יציבות אגן"),
    steps: [
      t("Band around the ankles (or above the knees), feet hip-width.", "גומייה סביב הקרסוליים (או מעל הברכיים), רגליים ברוחב האגן."),
      t("Quarter squat, chest up.", "חצי-רבע סקוואט, חזה פתוח."),
      t("Step sideways keeping tension on the band; then step back the other way.", "צעדים לצד תוך שמירה על מתח בגומייה; ואז חזרה לכיוון השני."),
    ],
    cue: t("Feet never come together; stay low.", "הרגליים לא נפגשות; להישאר נמוך."),
    mistake: t("Standing up straight; dragging the trailing foot.", "להזדקף; לגרור את הרגל האחורית."),
    fig: { head: [80, 34], body: ["80,41 79,62", "79,62 68,76 64,92", "79,62 90,76 96,92", "80,46 70,58", "80,46 90,58"], band: "66,86 94,86", arrow: "M110 70 L136 70" },
  },
  bulgarian: {
    name: t("Bulgarian split squat", "סקוואט בולגרי"),
    target: t("Quads, glutes, single-leg strength", "ארבע ראשי, ישבן, כוח רגל בודדת"),
    steps: [
      t("Stand ~2 steps in front of a bench, top of the back foot on it, dumbbells at your sides.", "לעמוד כשני צעדים לפני ספסל, גב כף הרגל האחורית עליו, משקולות בצדדים."),
      t("Lower straight down until the front thigh is about parallel.", "לרדת ישר למטה עד שהירך הקדמית בערך מקבילה."),
      t("Drive up through the front heel.", "לעלות בדחיפה מעקב הרגל הקדמית."),
    ],
    cue: t("Most of the weight on the front leg.", "רוב המשקל על הרגל הקדמית."),
    mistake: t("Front foot too close to the bench (knee shoots far forward).", "רגל קדמית קרובה מדי לספסל (הברך בורחת קדימה)."),
    fig: { head: [84, 26], body: ["84,33 82,60", "82,60 104,72 102,92", "82,60 72,84 48,72", "84,38 88,60"], bench: [28, 72, 30, 20], db: [[88, 62]], arrow: "M120 45 L120 70" },
  },
  "step-up": {
    name: t("Step-up", "עלייה על ספסל"),
    target: t("Quads, glutes", "ארבע ראשי, ישבן"),
    steps: [
      t("Whole foot on a sturdy bench or chair, dumbbells at your sides.", "כף רגל שלמה על ספסל או כיסא יציב, משקולות בצדדים."),
      t("Step up by pushing through that foot until standing tall on top.", "לעלות בדחיפה מאותה רגל עד עמידה זקופה למעלה."),
      t("Lower slowly with the same leg in control. Finish one side, then the other.", "לרדת לאט בשליטה עם אותה רגל. לסיים צד ואז את השני."),
    ],
    cue: t("Don't push off the bottom foot; the top leg does the work.", "לא לדחוף מהרגל התחתונה; הרגל העליונה עושה את העבודה."),
    mistake: t("Box too high; knee caving in.", "ספסל גבוה מדי; ברך שקורסת פנימה."),
    fig: { head: [90, 14], body: ["90,21 90,48", "90,48 106,56 104,72", "90,48 84,72 78,92", "90,26 94,48"], bench: [96, 72, 36, 20], db: [[94, 50]], arrow: "M70 70 L70 40" },
  },
  "sl-rdl": {
    name: t("Single-leg Romanian deadlift", "דדליפט רומני על רגל אחת"),
    target: t("Hamstrings, glutes, ankle stability", "ירך אחורית, ישבן, יציבות קרסול"),
    steps: [
      t("Stand on one leg, dumbbell in the opposite hand, standing knee soft.", "לעמוד על רגל אחת, משקולת ביד הנגדית, ברך הרגל העומדת רכה."),
      t("Hinge at the hip: chest goes forward, free leg goes back, in one line.", "ציר מהאגן: החזה קדימה, הרגל החופשית אחורה, בקו אחד."),
      t("Stop when you feel the hamstring stretch, squeeze the glute to stand.", "לעצור כשמרגישים מתיחה בירך האחורית, לכווץ ישבן ולחזור לעמידה."),
    ],
    cue: t("Hips stay square to the floor.", "האגן ישר מול הרצפה."),
    mistake: t("Rounding the back; opening the hip to the side.", "גב מעוגל; פתיחת האגן לצד."),
    fig: { head: [40, 50], body: ["48,53 80,56", "80,56 82,74 82,92", "80,56 132,52", "52,54 54,76"], db: [[54, 78]] },
  },
  "hip-thrust": {
    name: t("Hip thrust", "היפ תראסט"),
    target: t("Glutes (main running power muscle)", "ישבן (שריר הכוח העיקרי בריצה)"),
    steps: [
      t("Upper back against a bench or couch, dumbbell on the hips, feet flat.", "גב עליון נשען על ספסל או ספה, משקולת על האגן, כפות רגליים על הרצפה."),
      t("Drive the hips up until the body is flat from shoulders to knees.", "לדחוף את האגן למעלה עד קו ישר מהכתפיים לברכיים."),
      t("Squeeze 1 s at the top, lower with control.", "כיווץ שנייה למעלה, לרדת בשליטה."),
    ],
    cue: t("Chin tucked, ribs down; shins vertical at the top.", "סנטר פנימה, צלעות למטה; שוקיים אנכיות למעלה."),
    mistake: t("Over-arching the lower back at the top.", "קשת מוגזמת בגב התחתון למעלה."),
    fig: { head: [36, 62], body: ["44,68 82,68", "82,68 104,66 104,92", "46,70 70,64"], bench: [20, 70, 26, 22], db: [[80, 63]], arrow: "M82 90 L82 76" },
  },
  "pull-up": {
    name: t("Pull-up (band-assisted)", "מתח (בעזרת גומייה)"),
    target: t("Back, arms, posture (helps arm swing late in the race)", "גב, ידיים, יציבה (עוזר לתנופת הידיים בסוף המרוץ)"),
    steps: [
      t("Hang from the bar, hands shoulder-width. Loop a band over the bar and under a knee/foot if needed.", "תלייה מהמוט, ידיים ברוחב הכתפיים. אם צריך: גומייה סביב המוט ומתחת לברך/כף הרגל."),
      t("Pull the shoulder blades down, then pull until the chin passes the bar.", "למשוך את השכמות למטה ואז למשוך עד שהסנטר מעל המוט."),
      t("Lower slowly to full hang.", "לרדת לאט עד תלייה מלאה."),
    ],
    cue: t("Stop 2 reps before failure.", "לעצור 2 חזרות לפני כשל."),
    mistake: t("Swinging/kipping; half reps.", "נדנוד; חזרות חלקיות."),
    fig: { head: [80, 20], body: ["66,10 60,26 72,32", "94,10 100,26 88,32", "80,28 80,62", "80,62 76,80 70,92", "80,62 84,80 78,92"], bar: [44, 116, 10], noFloor: true },
  },
  copenhagen: {
    name: t("Copenhagen plank (short lever)", "Copenhagen plank (גרסה קצרה)"),
    target: t("Inner thigh (adductors), side core: protects the groin", "ירך פנימית (מקרבים), צד הבטן: מגן על המפשעה"),
    steps: [
      t("Side plank on the forearm; top KNEE on a bench, bottom leg below it.", "פלאנק צד על האמה; הברך העליונה על ספסל, הרגל התחתונה מתחתיו."),
      t("Lift the hips into a straight line, bottom leg can hang or lift.", "להרים את האגן לקו ישר, הרגל התחתונה יכולה להיות תלויה או מורמת."),
      t("Hold 20 s, switch sides.", "להחזיק 20 שנ', להחליף צד."),
    ],
    cue: t("Short lever (knee on the bench) is much easier than the foot; start here.", "גרסה קצרה (ברך על הספסל) קלה בהרבה מכף רגל; להתחיל כאן."),
    mistake: t("Hips sagging; starting with the long version.", "אגן צונח; להתחיל בגרסה הארוכה."),
    fig: { head: [34, 64], body: ["40,72 90,72 118,70", "40,72 40,90 58,90", "90,72 104,90"], bench: [112, 70, 40, 22] },
  },
  pogo: {
    name: t("Pogo hops", "קפיצות קרסול (pogo)"),
    target: t("Ankle stiffness & bounce (running economy)", "קשיחות וקפיציות קרסול (חיסכון אנרגטי בריצה)"),
    steps: [
      t("Stand tall, knees almost straight.", "עמידה זקופה, ברכיים כמעט ישרות."),
      t("Bounce quickly off the balls of the feet, mostly from the ankles.", "קפיצות קטנות ומהירות מכריות כף הרגל, בעיקר מהקרסול."),
      t("Minimal ground contact, like the floor is hot.", "מגע מינימלי ברצפה, כאילו הרצפה חמה."),
    ],
    cue: t("Quiet, quick, springy.", "שקט, מהיר, קפיצי."),
    mistake: t("Bending the knees a lot (turns into a squat jump).", "כפיפת ברכיים גדולה (הופך לקפיצת סקוואט)."),
    fig: { head: [80, 12], body: ["80,19 80,46", "80,46 78,66 80,84 86,85", "80,46 82,66 84,84 90,85", "80,24 72,44", "80,24 88,44"], arrow: "M110 86 L110 66 M118 66 L118 86" },
  },
  "a-skip": {
    name: t("A-skip", "סקיפ A"),
    target: t("Running form: knee drive, foot strike under the body", "טכניקת ריצה: הרמת ברך, נחיתה מתחת לגוף"),
    steps: [
      t("Skip forward: drive one knee to hip height, the other foot does a small hop.", "דילוג קדימה: להרים ברך אחת לגובה האגן, הרגל השנייה עושה קפיצה קטנה."),
      t("Bring the foot down actively under the hips.", "להוריד את כף הרגל באופן פעיל מתחת לאגן."),
      t("Arms swing opposite to the legs, as in running.", "הידיים מתנופפות הפוך לרגליים, כמו בריצה."),
    ],
    cue: t("Tall posture, light and rhythmic.", "גוף גבוה, קליל וקצבי."),
    mistake: t("Leaning back; reaching the foot forward.", "הטיה אחורה; שליחת כף הרגל קדימה."),
    fig: { head: [82, 14], body: ["82,21 80,48", "80,48 100,50 98,70", "80,48 80,70 82,92", "82,26 94,40", "82,26 70,40"], arrow: "M112 60 L140 60" },
  },
  "hip-flexor": {
    name: t("Hip-flexor lunge stretch", "מתיחת כופף ירך"),
    target: t("Front of the hip (tight from sitting and running)", "קדמת האגן (מתקצר מישיבה ומריצה)"),
    steps: [
      t("Half-kneel: back knee on a soft surface, front foot flat ahead.", "חצי כריעה: ברך אחורית על משטח רך, כף רגל קדמית על הרצפה לפנים."),
      t("Tuck the pelvis (squeeze the back-leg glute), then shift gently forward.", "לגלגל את האגן פנימה (לכווץ את הישבן של הרגל האחורית) ואז להעביר משקל קדימה בעדינות."),
      t("Feel the stretch at the front of the back hip. Optional: raise the same-side arm.", "להרגיש מתיחה בקדמת האגן של הרגל האחורית. אופציה: להרים את היד באותו צד."),
    ],
    cue: t("Small pelvic tuck > big lunge.", "גלגול אגן קטן עדיף על לאנג' גדול."),
    mistake: t("Arching the lower back instead of stretching the hip.", "קשת בגב התחתון במקום מתיחה באגן."),
    fig: { head: [76, 30], body: ["76,37 76,64", "76,64 100,70 102,92", "76,64 62,92 40,92", "76,40 80,16"] },
  },
  "calf-wall": {
    name: t("Calf stretch on a wall", "מתיחת שוק ליד קיר"),
    target: t("Calves (straight knee) and soleus (bent knee)", "שוק (ברך ישרה) ושריר הסולאוס (ברך כפופה)"),
    steps: [
      t("Hands on the wall, one foot back with the heel down, back knee straight.", "ידיים על הקיר, רגל אחת אחורה עם עקב על הרצפה, ברך אחורית ישרה."),
      t("Lean in until you feel the upper calf. Hold 45 s.", "להישען עד שמרגישים את השוק העליונה. 45 שנ'."),
      t("Then bend the back knee slightly, heel still down: stretch moves lower. Hold 45 s.", "ואז לכופף מעט את הברך האחורית, העקב עדיין למטה: המתיחה יורדת נמוך יותר. 45 שנ'."),
    ],
    cue: t("Back foot points straight ahead.", "כף הרגל האחורית מכוונת ישר קדימה."),
    mistake: t("Heel lifting; foot turned out.", "עקב שמתרומם; כף רגל פונה החוצה."),
    fig: { head: [104, 28], body: ["100,35 82,58", "82,58 50,92", "82,58 98,74 100,92", "100,38 120,40"], wall: 124 },
  },
  "hamstring-strap": {
    name: t("Hamstring stretch with strap", "מתיחת ירך אחורית עם רצועה"),
    target: t("Hamstrings", "ירך אחורית"),
    steps: [
      t("Lie on your back, strap (or towel/band) around one foot.", "לשכב על הגב, רצועה (או מגבת/גומייה) סביב כף רגל אחת."),
      t("Raise the leg, knee straight, until a mild stretch behind the thigh.", "להרים את הרגל עם ברך ישרה עד מתיחה עדינה מאחורי הירך."),
      t("Other leg relaxed on the floor. Hold 45 s, breathe.", "הרגל השנייה רפויה על הרצפה. 45 שנ', לנשום."),
    ],
    cue: t("Gentle: 4/10 stretch, no pulling hard.", "עדין: מתיחה בעוצמה 4/10, בלי למשוך חזק."),
    mistake: t("Lifting the head/shoulders; bending the knee a lot.", "הרמת ראש/כתפיים; כפיפה גדולה של הברך."),
    fig: { head: [22, 84], body: ["30,87 74,87", "74,87 96,32", "74,87 134,89", "40,86 58,70"], strap: "58,70 96,32" },
  },
  "figure-4": {
    name: t("Figure-4 glute stretch", "מתיחת ישבן בתנוחת 4"),
    target: t("Glutes, piriformis", "ישבן, פיריפורמיס"),
    steps: [
      t("Lie on your back, knees bent.", "לשכב על הגב, ברכיים כפופות."),
      t("Cross one ankle over the opposite knee (a '4' shape).", "להניח קרסול אחד על הברך הנגדית (צורת 4)."),
      t("Pull the bottom thigh toward your chest until the stretch is in the crossed-leg glute. Hold 45 s.", "למשוך את הירך התחתונה לכיוון החזה עד מתיחה בישבן של הרגל המוצלבת. 45 שנ'."),
    ],
    cue: t("Keep the crossed foot flexed (protects the knee).", "כף הרגל המוצלבת מכופפת למעלה (מגן על הברך)."),
    mistake: t("Lifting the head and straining the neck.", "הרמת הראש ומאמץ בצוואר."),
    fig: { head: [22, 84], body: ["30,87 70,87", "70,87 84,60 106,64", "70,87 96,74 86,60", "40,85 82,64"] },
  },
  "open-book": {
    name: t("Open book", "Open book (פתיחת ספר)"),
    target: t("Upper-back rotation (posture, breathing)", "סיבוב גב עליון (יציבה, נשימה)"),
    steps: [
      t("Lie on your side, knees bent to hip height, arms straight in front, palms together.", "לשכב על הצד, ברכיים כפופות לגובה האגן, ידיים ישרות לפנים, כפות צמודות."),
      t("Open the top arm in an arc to the other side, following the hand with your eyes.", "לפתוח את היד העליונה בקשת לצד השני, העיניים עוקבות אחרי היד."),
      t("Pause 2 s, return. Knees stay together.", "עצירה של 2 שנ', לחזור. הברכיים נשארות צמודות."),
    ],
    cue: t("Rotate from the upper back, breathe out as you open.", "לסובב מהגב העליון, נשיפה בזמן הפתיחה."),
    mistake: t("Knees lifting apart as you rotate.", "ברכיים שנפרדות בזמן הסיבוב."),
    fig: { head: [24, 78], body: ["32,82 70,84", "70,84 94,78 86,90", "32,82 56,88", "32,80 12,62"], arrow: "M56 74 Q40 54 18 58" },
  },
  "knee-to-wall": {
    name: t("Knee-to-wall (ankle mobility)", "ברך לקיר (ניידות קרסול)"),
    target: t("Ankle dorsiflexion (calf/Achilles health)", "כפיפת קרסול (בריאות שוק ואכילס)"),
    steps: [
      t("Face a wall, front foot a few cm from it, other knee down or foot behind.", "מול קיר, כף הרגל הקדמית כמה ס\"מ ממנו, הברך השנייה על הרצפה או רגל מאחור."),
      t("Drive the front knee forward to touch the wall, heel stays down.", "לדחוף את הברך הקדמית קדימה עד שהיא נוגעת בקיר, העקב נשאר על הרצפה."),
      t("Easy? Move the foot back 1 cm. 10 slow reps.", "קל? להרחיק את כף הרגל בסנטימטר. 10 חזרות איטיות."),
    ],
    cue: t("Knee travels over the 2nd toe.", "הברך נעה מעל האצבע השנייה."),
    mistake: t("Heel lifting; knee falling inward.", "עקב שמתרומם; ברך שנופלת פנימה."),
    fig: { head: [96, 34], body: ["96,41 92,66", "92,66 122,74 112,92", "92,66 76,92 56,92", "96,46 124,52"], wall: 126, arrow: "M104 80 L118 80" },
  },
};

export function guideFor(id: string): Guide | undefined {
  return GUIDE[id];
}
