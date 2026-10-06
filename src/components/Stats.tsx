import { METRICS, type ClubAverage, type MetricKey, fmtDate } from "@/lib/types";

function fmt(v: number | null, decimals: number) {
  if (v == null) return "—";
  return decimals === 0 && Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(decimals);
}

export function MetricTiles({ rows }: { rows: ClubAverage[] }) {
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  const prev = rows.length > 1 ? rows[rows.length - 2]! : null;
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
      {METRICS.map((m) => {
        const v = last[m.key];
        const p = prev?.[m.key] ?? null;
        const d = v != null && p != null ? +(v - p).toFixed(m.decimals) : null;
        const lower = "lowerIsBetter" in m && m.lowerIsBetter;
        const good = d == null ? null : d === 0 ? null : lower ? d < 0 : d > 0;
        return (
          <div key={m.key} className="card !px-3.5 !py-3">
            <div className="eyebrow">{m.label}</div>
            <div className="font-display font-bold text-[28px] leading-none my-1 num">
              {fmt(v, m.decimals)}{m.unit && <small className="text-sm text-ink3 font-semibold ml-0.5">{m.unit}</small>}
            </div>
            <div className={`text-xs num ${good === true ? "text-good" : good === false ? "text-bad" : "text-ink3"}`}>
              {d == null ? (prev ? "—" : "First session") : `${d > 0 ? "+" : ""}${fmt(d, m.decimals)} vs last`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Scaled SVG line chart of one metric across sessions. */
export function TrendChart({ rows, metric }: { rows: ClubAverage[]; metric: MetricKey }) {
  const m = METRICS.find((x) => x.key === metric)!;
  const pts = rows.filter((r) => r[metric] != null);
  if (pts.length < 2) return <p className="text-sm text-ink3">Log a second session with this club to see a trend.</p>;
  const W = 640, H = 220, L = 52, R = 16, T = 18, B = 34;
  const vals = pts.map((r) => r[metric] as number);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.25, Math.abs(hi || 1) * 0.02);
  lo -= pad; hi += pad;
  const x = (i: number) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  const line = pts.map((r, i) => `${x(i)},${y(r[metric] as number)}`).join(" ");
  const area = `M${x(0)},${H - B} L${line.replace(/ /g, " L")} L${x(pts.length - 1)},${H - B} Z`;
  const lastV = vals[vals.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`${m.label} over ${pts.length} sessions`}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink3)">{fmt(t, m.decimals)}</text>
        </g>
      ))}
      <path d={area} fill="var(--accent)" opacity=".1" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((r, i) => (
        <g key={r.session_id}>
          <circle cx={x(i)} cy={y(r[metric] as number)} r={i === pts.length - 1 ? 5.5 : 3.5} fill={i === pts.length - 1 ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth="2" />
          <text x={x(i)} y={H - B + 18} textAnchor="middle" fontSize="11" fill="var(--ink3)">{fmtDate(r.session_date)}</text>
        </g>
      ))}
      <text x={x(pts.length - 1)} y={y(lastV) - 12} textAnchor={pts.length > 3 ? "end" : "middle"} fontSize="13" fontWeight="700" fill="var(--accent)">
        {fmt(lastV, m.decimals)}{m.unit === "rpm" ? "" : m.unit}
      </text>
    </svg>
  );
}

export function SessionTable({ rows }: { rows: ClubAverage[] }) {
  if (rows.length === 0) return null;
  const sorted = [...rows].reverse();
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="data">
        <thead><tr><th>Date</th><th>Source</th><th className="r">Shots</th><th className="r">Carry</th><th className="r">Ball spd</th><th className="r">Launch</th><th className="r">Spin</th><th className="r">Smash</th></tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.session_id} className="num">
              <td>{fmtDate(r.session_date)}</td>
              <td><span className={`chip ${r.source === "kit" ? "chip-accent" : ""}`}>{r.source === "kit" ? "KIT" : r.source === "bay_import" ? "Bay" : "Manual"}</span></td>
              <td className="r">{r.shots}</td>
              <td className="r font-semibold">{fmt(r.carry, 0)}</td>
              <td className="r">{fmt(r.ball_speed, 0)}</td>
              <td className="r">{fmt(r.launch_angle, 1)}°</td>
              <td className="r">{fmt(r.spin_rate, 0)}</td>
              <td className="r">{fmt(r.smash_factor, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
