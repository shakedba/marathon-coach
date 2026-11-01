"use client";
import { useState } from "react";

type L = Record<string, string>;
export function GarminConnect({ labels }: { labels: L }) {
  const [stage, setStage] = useState<"form" | "mfa" | "busy" | "ok">("form");
  const [err, setErr] = useState("");
  async function post(url: string, body: unknown) {
    setErr("");
    const prev = stage;
    setStage("busy");
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? `Error ${r.status}`); setStage(prev); return; }
    if (j.status === "mfa") setStage("mfa");
    else { setStage("ok"); location.reload(); }
  }
  if (stage === "ok") return <p>✓</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (stage === "mfa") post("/api/garmin/mfa", { code: f.get("code") });
        else post("/api/garmin/login", { email: f.get("email"), password: f.get("password") });
      }}
    >
      {stage !== "mfa" ? (
        <>
          <label>{labels.email}</label>
          <input name="email" type="email" autoComplete="username" required dir="ltr" />
          <label>{labels.password}</label>
          <input name="password" type="password" autoComplete="current-password" required dir="ltr" />
        </>
      ) : (
        <>
          <label>{labels.mfaCode}</label>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required dir="ltr" />
        </>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="primary" disabled={stage === "busy"}>{stage === "busy" ? "…" : labels.connect}</button>
      </div>
      {err && <p style={{ color: "var(--bad)" }}>{err}</p>}
      <p className="muted">{labels.pwNote}</p>
    </form>
  );
}
