"use client";
import { useState } from "react";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  return (
    <form action="/api/login" method="post" onSubmit={() => setBusy(true)}>
      <label>Password · סיסמה</label>
      <input name="password" type="password" autoComplete="current-password" required dir="ltr" />
      <div style={{ marginTop: 12 }}>
        <button className="primary" disabled={busy} aria-busy={busy || undefined}>
          {busy ? <><span className="spinner" aria-hidden /> …</> : "Log in · כניסה"}
        </button>
      </div>
    </form>
  );
}
