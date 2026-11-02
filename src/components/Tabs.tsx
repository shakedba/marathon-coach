"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

/** Pages reached from the "More" tab: the tab stays highlighted and a back link is shown on them. */
export const MORE_PAGES = ["/log", "/races", "/exercises", "/settings"];

const ICONS: Record<string, string> = { "/": "●", "/week": "▦", "/progress": "↗", "/more": "☰" };

/** Icon swaps to a spinner the moment a tab is tapped, until the page arrives. */
function TabIcon({ icon }: { icon: string }) {
  const { pending } = useLinkStatus();
  return <div aria-hidden>{pending ? <span className="spinner" /> : icon}</div>;
}

const isOn = (path: string, href: string) =>
  href === "/" ? path === "/" :
  path === href || path.startsWith(href + "/") ||
  (href === "/week" && path.startsWith("/day/")) ||
  (href === "/more" && MORE_PAGES.some((p) => path === p || path.startsWith(p + "/")));

export function Tabs({ labels }: { labels: Record<string, string> }) {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="tabs">
      {Object.entries(labels).map(([href, label]) => {
        const on = isOn(path, href);
        return (
          <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <TabIcon icon={ICONS[href]} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** "‹ More" link at the top of pages that live under the More tab. */
export function BackToMore({ label }: { label: string }) {
  const path = usePathname();
  if (!MORE_PAGES.some((p) => path === p || path.startsWith(p + "/"))) return null;
  return <Link href="/more" className="back">{label}</Link>;
}
