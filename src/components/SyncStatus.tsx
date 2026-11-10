"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncNow } from "@/app/actions";
import { useToast } from "./Toast";

const STALE_MS = 3 * 60 * 60 * 1000;

function ago(iso: string, he: boolean) {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return he ? "עכשיו" : "just now";
  if (m < 60) return he ? `לפני ${m} דק'` : `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? (he ? `לפני ${h} שע'` : `${h} h ago`) : he ? `לפני ${Math.round(h / 24)} ימים` : `${Math.round(h / 24)} d ago`;
}

/**
 * "Updated X ago ↻". Syncs automatically on open when the last sync is older than 3 h (once per tab session),
 * on tap, and when PullToRefresh fires "mc:sync".
 */
export function SyncStatus({ lastAt, error, lang }: { lastAt: string | null; error?: string; lang: "he" | "en" }) {
  const he = lang === "he";
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const router = useRouter();
  const toast = useToast();
  const running = useRef(false);

  async function run(manual: boolean) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await syncNow();
      if (r && r.ok === false) toast("error", r.message ?? (he ? "הסנכרון נכשל" : "Sync failed"));
      else if (manual) toast("success", he ? "הסנכרון הושלם" : "Sync complete");
      router.refresh();
    } catch {
      toast("error", he ? "אין חיבור - ננסה שוב בפתיחה הבאה" : "Offline - will retry next time");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    const key = "mc-autosync";
    let done = false;
    try { done = sessionStorage.getItem(key) === "1"; } catch { /* private mode */ }
    const stale = !lastAt || Date.now() - Date.parse(lastAt) > STALE_MS;
    if (stale && !done && navigator.onLine) {
      try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
      void run(false);
    }
    const onPull = () => void run(true);
    window.addEventListener("mc:sync", onPull);
    const iv = setInterval(() => tick((x) => x + 1), 60_000);
    return () => { window.removeEventListener("mc:sync", onPull); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className="sync" onClick={() => run(true)} disabled={busy} aria-busy={busy || undefined}
      title={error ?? undefined} aria-label={he ? "סנכרן עכשיו" : "Sync now"}>
      {busy ? <><span className="spinner" aria-hidden /> {he ? "מסנכרן…" : "Syncing…"}</> : (
        <>
          {error && <span className="dot bad" aria-hidden />}
          {lastAt ? ago(lastAt, he) : he ? "לא סונכרן" : "not synced"} ↻
        </>
      )}
    </button>
  );
}
