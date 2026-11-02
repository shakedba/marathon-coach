"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = { "/": "●", "/week": "▦", "/log": "≡", "/progress": "↗", "/races": "⚑", "/settings": "⚙" };

/** Icon swaps to a spinner the moment a tab is tapped, until the page arrives. */
function TabIcon({ icon }: { icon: string }) {
  const { pending } = useLinkStatus();
  return <div aria-hidden>{pending ? <span className="spinner" /> : icon}</div>;
}

export function Tabs({ labels }: { labels: Record<string, string> }) {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="tabs">
      {Object.entries(labels).map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? "on" : ""} aria-current={path === href ? "page" : undefined}>
          <TabIcon icon={ICONS[href]} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
