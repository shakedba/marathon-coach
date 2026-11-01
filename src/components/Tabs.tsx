"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = { "/": "●", "/week": "▦", "/log": "≡", "/progress": "↗", "/races": "⚑", "/settings": "⚙" };

export function Tabs({ labels }: { labels: Record<string, string> }) {
  const path = usePathname();
  if (path === "/login") return null;
  return (
    <nav className="tabs">
      {Object.entries(labels).map(([href, label]) => (
        <Link key={href} href={href} className={path === href ? "on" : ""}>
          <div aria-hidden>{ICONS[href]}</div>
          {label}
        </Link>
      ))}
    </nav>
  );
}
