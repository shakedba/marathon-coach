import { diffDays, todayLocal } from "@/lib/dates";
import { pick, tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { HAIFA_RACE_PLAN, RACES, TLV_OUTLINE } from "@/lib/plan";

export default async function RacesPage() {
  const lang = await getLang();
  const t = tr(lang);
  const today = todayLocal();
  const he = lang === "he";
  return (
    <>
      <h1>{t("races")}</h1>
      <p><a className="btn" href="/exercises">💪🧘 {he ? "ספריית תרגילי כוח וגמישות" : "Strength & mobility exercise library"}</a></p>
      {RACES.map((r) => (
        <div className="card" key={r.id}>
          <div className="spread">
            <div className="big">{pick(lang, r.name)}</div>
            <span className="tag">{Math.max(0, diffDays(r.date, today))} {t("daysTo")}{he ? "מרוץ" : "race"}</span>
          </div>
          <div className="muted ltr">{r.date.split("-").reverse().join("/")} · {r.startTime}</div>
          <div>{t("target")}: <b className="ltr">{r.goalTime ? `${r.goalTime} (5:10/km)` : t("tbd")}</b></div>
        </div>
      ))}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t("racePlan")} · {pick(lang, RACES[0].name)}</h2>
        <table className="ltr">
          <thead><tr><th>km</th><th>pace</th><th>HR</th><th>time</th></tr></thead>
          <tbody>{HAIFA_RACE_PLAN.map((s) => <tr key={s.km}><td>{s.km}</td><td>{s.pace}</td><td>{s.hr}</td><td>{s.cum}</td></tr>)}</tbody>
        </table>
        <ul>
          <li><b>{he ? "חוק:" : "Rule:"}</b> {he ? "דופק מעל 158 לפני חצי הדרך = להאט, גם אם הקצב מרגיש קל." : "HR above 158 before halfway = slow down, even if the pace feels easy."}</li>
          <li>{he ? "חום מעל 22°C: להוסיף 5-10 שנ' לק\"מ." : "Above 22°C: add 5-10 s/km."}</li>
          <li>{he ? "רץ לבד, בקצב שלך." : "Run solo, at your own pace."}</li>
        </ul>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t("fuel")}</h2>
        <p>{he ? "SiS GO Isotonic (כ-22 גרם פחמימה): אחד ב-06:15, ואז כל 25 דקות (8-9 סה\"כ), עם כמה לגימות מים." : "SiS GO Isotonic (~22 g carbs): one at 06:15, then every 25 min (8-9 total), with a few sips of water."}</p>
        <h2>{t("morning")}</h2>
        <table className="ltr"><tbody>
          {[["03:45", he ? "השכמה" : "Wake up"], ["04:00", he ? "ארוחת בוקר מוכרת" : "Tested breakfast"], ["~05:00", he ? "יציאה לחיפה" : "Leave for Haifa"], ["06:00", he ? "חימום קל 5-10 דק'" : "Easy warm-up 5-10 min"], ["06:15", he ? "ג'ל ראשון" : "First gel"], ["06:30", he ? "זינוק" : "Start"]].map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}
        </tbody></table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t("tlvOutline")}</h2>
        <table>
          <tbody>{TLV_OUTLINE.map((w) => (
            <tr key={w.weekStart}><td className="ltr">{w.weekStart.slice(5).split("-").reverse().join("/")}</td><td>{pick(lang, w.phase)}</td><td className="ltr">~{w.km}</td><td>{pick(lang, w.key)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
