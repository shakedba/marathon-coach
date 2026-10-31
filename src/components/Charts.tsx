import { fmtPace } from "@/lib/dates";

/** Weekly km: actual = filled bar (accent), planned = ink tick. Native <title> gives the hover tooltip. */
export function VolumeChart({ data, labels }: { data: { week: string; planned: number; actual: number }[]; labels: { planned: string; actual: string } }) {
  const W = 680, H = 200, pad = { l: 30, r: 8, t: 10, b: 22 };
  const max = Math.max(10, ...data.map((d) => Math.max(d.planned, d.actual))) * 1.1;
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, 25, 50, 75, 100].filter((v) => v < max);
  return (
    <figure style={{ margin: 0 }}>
      <div className="row muted" style={{ fontSize: ".8rem" }}>
        <span><svg width="12" height="10"><rect width="12" height="10" rx="2" fill="var(--accent)" /></svg> {labels.actual}</span>
        <span><svg width="14" height="10"><rect y="4" width="14" height="2" fill="var(--ink)" /></svg> {labels.planned}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="weekly volume" style={{ direction: "ltr" }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 4} y={y(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * bw;
          const bwInner = Math.max(2, bw - 2);
          return (
            <g key={d.week}>
              <title>{`${d.week}: ${d.actual} / ${d.planned} km`}</title>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {d.actual > 0 && <rect x={x + 1} y={y(d.actual)} width={bwInner} height={y(0) - y(d.actual)} rx="2" fill="var(--accent)" />}
              {d.planned > 0 && <rect x={x + 1} y={y(d.planned) - 1} width={bwInner} height="2" fill="var(--ink)" />}
              {i % 3 === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle">{d.week.slice(5).split("-").reverse().join("/")}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Avg HR on marathon-pace laps per run (single series: no legend, title names it). */
export function MpHrChart({ pts }: { pts: { date: string; pace: number; hr: number; km: number }[] }) {
  if (pts.length < 2) return <p className="muted">—</p>;
  const W = 680, H = 180, pad = { l: 30, r: 10, t: 10, b: 22 };
  const lo = Math.min(...pts.map((p) => p.hr)) - 4, hi = Math.max(...pts.map((p) => p.hr)) + 4;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (pts.length - 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const ticks = [lo, (lo + hi) / 2, hi].map(Math.round);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="HR at marathon pace" style={{ direction: "ltr" }}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={pad.l - 4} y={y(v) + 3} textAnchor="end">{v}</text>
        </g>
      ))}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={pts.map((p, i) => `${x(i)},${y(p.hr)}`).join(" ")} />
      {pts.map((p, i) => (
        <g key={p.date + i}>
          <title>{`${p.date}: HR ${p.hr} @ ${fmtPace(p.pace)}/km over ${p.km} km`}</title>
          <circle cx={x(i)} cy={y(p.hr)} r="10" fill="transparent" />
          <circle cx={x(i)} cy={y(p.hr)} r="4" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />
        </g>
      ))}
      <text x={x(0)} y={H - 6}>{pts[0].date.slice(5)}</text>
      <text x={x(pts.length - 1)} y={H - 6} textAnchor="end">{pts[pts.length - 1].date.slice(5)}</text>
    </svg>
  );
}
