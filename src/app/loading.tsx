/** Shown instantly while a page's data loads: skeleton cards, so navigation always gives feedback. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <div className="skel skel-title" />
      <div className="skel skel-card" />
      <div className="skel skel-card short" />
      <div className="skel skel-card short" />
    </div>
  );
}
