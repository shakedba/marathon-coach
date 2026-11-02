"use client";
import { useState } from "react";
import { useToast } from "./Toast";

type L = Record<string, string>;
export function GarminConnect({ labels }: { labels: L }) {
  const [stage, setStage] = useState<"form" | "mfa" | "busy" | "syncing" | "ok">("form");
  const [err, setErr] = useState("");
  const toast = useToast();
  async function post(url: string, body: unknown) {
    setErr("");
    const prev = stage;
    setStage("busy");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j.error ?? `Error ${r.status}`;
        setErr(msg);
        toast("error", msg);
        setStage(prev);
        return;
      }
      if (j.status === "mfa") {
        setStage("mfa");
        toast("info", labels.mfaCode);
        return;
      }
      // First sync in its own request (own 60 s budget): history, recovery data, workouts to the watch.
      setStage("syncing");
      toast("success", labels.connected);
      await fetch("/api/sync", { method: "POST" }).catch(() => null);
      setStage("ok");
      location.reload();
    } catch {
      setErr(labels.failed);
      toast("error", labels.failed);
      setStage(prev);
    }
  }
  if (stage === "syncing" || stage === "ok") {
    return <p role="status"><span className="spinner" aria-hidden /> {labels.firstSync}</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (stage === "mfa") post("/api/garmin/mfa", { code: f.get("code") });
        else post("/api/garmin/login", { email: f.get("garmin_email"), password: f.get("garmin_password") });
      }}
    >
      {stage !== "mfa" ? (
        <>
          <label>{labels.email}</label>
          <input name="garmin_email" type="email" autoComplete="off" spellCheck={false} autoCapitalize="none" required dir="ltr" placeholder="name@example.com" />
          <label>{labels.password}</label>
          {/* "new-password" stops Chrome from autofilling the app's own saved login into the Garmin field */}
          <input name="garmin_password" type="password" autoComplete="new-password" required dir="ltr" />
        </>
      ) : (
        <>
          <label>{labels.mfaCode}</label>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required dir="ltr" />
        </>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" disabled={stage === "busy"} aria-busy={stage === "busy" || undefined}>
          {stage === "busy" ? <><span className="spinner" aria-hidden /> {labels.connecting}</> : labels.connect}
        </button>
      </div>
      {err && <p style={{ color: "var(--bad)" }}>{err}</p>}
      <p className="muted">{labels.typeNote}</p>
      <p className="muted">{labels.pwNote}</p>
    </form>
  );
}
