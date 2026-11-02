import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/lang";
import { Tabs } from "@/components/Tabs";
import { tr } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = { title: "Marathon Coach", manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg", apple: "/icon.svg" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b6bcb" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = tr(lang);
  const labels = { "/": t("today"), "/week": t("week"), "/log": t("log"), "/progress": t("progress"), "/races": t("races"), "/settings": t("settings") };
  return (
    <html lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <body>
        <ToastProvider>
          <main>{children}</main>
          <Tabs labels={labels} />
        </ToastProvider>
      </body>
    </html>
  );
}
