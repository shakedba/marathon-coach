"use client";
import { useState } from "react";

/** Full-page navigation to Strava: show that something is happening until the browser leaves. */
export function StravaConnectLink({ label, pending }: { label: string; pending: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <a
      className="btn primary"
      href="/api/strava/connect"
      aria-busy={busy || undefined}
      onClick={() => setBusy(true)}
      style={busy ? { pointerEvents: "none", opacity: 0.8 } : undefined}
    >
      {busy ? <><span className="spinner" aria-hidden /> {pending}</> : label}
    </a>
  );
}
