import type { Figure } from "@/lib/exercise-guide";

/** Stick-figure drawing of an exercise position (decorative; the text carries the instructions). */
/** `uid` must be unique on the page (marker ids inside collapsed <details> would otherwise hide every arrowhead). */
export function ExerciseFigure({ fig, label, uid }: { fig: Figure; label: string; uid: string }) {
  const id = `ah-${uid}`;
  return (
    <svg viewBox="0 0 160 100" width="100%" style={{ maxWidth: 260, direction: "ltr", display: "block" }} role="img" aria-label={label}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>
      {!fig.noFloor && <line x1="4" y1="92.5" x2="156" y2="92.5" stroke="var(--line)" strokeWidth="2" />}
      {fig.wall !== undefined && <line x1={fig.wall} y1="4" x2={fig.wall} y2="92" stroke="var(--muted)" strokeWidth="3" />}
      {fig.bench && <rect x={fig.bench[0]} y={fig.bench[1]} width={fig.bench[2]} height={fig.bench[3]} rx="2" fill="var(--soft)" stroke="var(--muted)" strokeWidth="1.5" />}
      {fig.bar && <line x1={fig.bar[0]} y1={fig.bar[2]} x2={fig.bar[1]} y2={fig.bar[2]} stroke="var(--muted)" strokeWidth="3" strokeLinecap="round" />}
      {fig.strap && <polyline points={fig.strap} fill="none" stroke="var(--warn)" strokeWidth="1.5" />}
      {fig.body.map((p, i) => (
        <polyline key={i} points={p} fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle cx={fig.head[0]} cy={fig.head[1]} r="6.5" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
      {fig.db?.map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 7} y={y - 2} width="14" height="4" rx="1" fill="var(--muted)" />
          <rect x={x - 8} y={y - 4} width="3" height="8" rx="1" fill="var(--ink)" />
          <rect x={x + 5} y={y - 4} width="3" height="8" rx="1" fill="var(--ink)" />
        </g>
      ))}
      {fig.band && <polyline points={fig.band} fill="none" stroke="var(--good)" strokeWidth="2.5" strokeDasharray="4 3" />}
      {fig.arrow && <path d={fig.arrow} fill="none" stroke="var(--accent)" strokeWidth="2" markerEnd={`url(#${id})`} />}
    </svg>
  );
}
