import Link from "next/link";
import { tr } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export default async function MorePage() {
  const lang = await getLang();
  const t = tr(lang);
  const he = lang === "he";
  const items = [
    { href: "/log", ic: "≡", title: t("log"), sub: he ? "כל הריצות והאימונים שנרשמו" : "All logged runs and sessions" },
    { href: "/races", ic: "⚑", title: t("races"), sub: he ? "חיפה ותל אביב: יעדים ותוכנית מרוץ" : "Haifa & Tel Aviv: targets and race plan" },
    { href: "/exercises", ic: "💪", title: he ? "תרגילי כוח וגמישות" : "Strength & mobility exercises", sub: he ? "איור והסבר לכל תרגיל" : "Drawing and how-to for each exercise" },
    { href: "/settings", ic: "⚙", title: t("settings"), sub: he ? "Garmin, Strava, שפה, סנכרון, פרטיות" : "Garmin, Strava, language, sync, privacy" },
  ];
  return (
    <>
      <h1>{t("more")}</h1>
      <div className="card" style={{ padding: "4px 12px" }}>
        <ul className="menu">
          {items.map((x) => (
            <li key={x.href}>
              <Link href={x.href}>
                <span className="ic" aria-hidden>{x.ic}</span>
                <span className="tx"><b>{x.title}</b><span className="muted">{x.sub}</span></span>
                <span className="chev" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
