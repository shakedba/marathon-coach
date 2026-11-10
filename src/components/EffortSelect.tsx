import { tr } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

/** Session RPE (CR-10): 1 = very easy, 10 = maximal. */
export function EffortSelect({ lang, name = "feel", required }: { lang: Lang; name?: string; required?: boolean }) {
  const he = lang === "he";
  const word = (n: number) =>
    n <= 2 ? (he ? "קל מאוד" : "very easy") : n <= 4 ? (he ? "קל" : "easy") : n <= 6 ? (he ? "בינוני" : "moderate") : n <= 8 ? (he ? "קשה" : "hard") : he ? "מקסימלי" : "maximal";
  return (
    <select name={name} style={{ width: 150 }} defaultValue="" aria-label={tr(lang)("feel")} required={required}>
      <option value="">{tr(lang)("feel")}</option>
      {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} · {word(i + 1)}</option>)}
    </select>
  );
}
