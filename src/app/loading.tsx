/** Shown instantly while a tab's data loads, so navigation always gives feedback. */
export default function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden /> <span>טוען… · Loading…</span>
    </div>
  );
}
