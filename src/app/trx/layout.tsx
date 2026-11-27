import type { Metadata } from "next";

/** Own manifest, so "Add to Home Screen" from here gives a separate TRX icon that opens straight into the timer. */
export const metadata: Metadata = { title: "TRX", manifest: "/trx.webmanifest", icons: { icon: "/trx-icon.svg", apple: "/trx-icon.svg" } };

export default function TrxLayout({ children }: { children: React.ReactNode }) {
  return children;
}
