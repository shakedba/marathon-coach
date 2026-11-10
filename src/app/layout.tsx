import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/lang";
import { BackToMore, Tabs } from "@/components/Tabs";
import { tr } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import { PullToRefresh } from "@/components/PullToRefresh";

export const metadata: Metadata = { title: "Marathon Coach", manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg", apple: "/icon.svg" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b6bcb" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = tr(lang);
  const labels = { "/": t("today"), "/week": t("plan"), "/progress": t("progress"), "/more": t("more") };
  return (
    <html lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <body>
        <ToastProvider>
          <PullToRefresh />
          <main><BackToMore label={lang === "he" ? "› " + t("more") : "‹ " + t("more")} />{children}</main>
          <Tabs labels={labels} />
        </ToastProvider>
      </body>
    </html>
  );
}
