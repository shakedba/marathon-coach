"use client";
import { useState } from "react";

/** Plain POST form button (non server-action routes) with confirm + pending state. */
export function PostButton({ action, label, pending, confirm }: { action: string; label: string; pending: string; confirm?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      action={action}
      method="post"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) return e.preventDefault();
        setBusy(true);
      }}
    >
      <button disabled={busy} aria-busy={busy || undefined}>
        {busy ? <><span className="spinner" aria-hidden /> {pending}</> : label}
      </button>
    </form>
  );
}
