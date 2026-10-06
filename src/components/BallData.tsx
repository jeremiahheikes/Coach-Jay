"use client";
import { useMemo, useState } from "react";
import { METRICS, type ClubAverage, type MetricKey } from "@/lib/types";
import { MetricTiles, SessionTable, TrendChart } from "./Stats";

/** Club + metric switcher over a student's per-session averages. */
export function BallData({ averages, action }: { averages: ClubAverage[]; action?: React.ReactNode }) {
  const clubs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of averages) counts.set(a.club, (counts.get(a.club) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [averages]);
  const [club, setClub] = useState<string>(clubs[0] ?? "7 Iron");
  const [metric, setMetric] = useState<MetricKey>("carry");
  const rows = useMemo(() => averages.filter((a) => a.club === club), [averages, club]);

  if (averages.length === 0) {
    return (
      <div className="card flex flex-col gap-3 items-start">
        <p className="text-ink2">No ball data yet.</p>
        {action}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5 overflow-x-auto">
          {clubs.map((c) => (
            <button key={c} onClick={() => setClub(c)} className={`px-2.5 py-1 rounded-md text-sm font-semibold whitespace-nowrap ${c === club ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{c}</button>
          ))}
        </div>
        {action}
      </div>
      <MetricTiles rows={rows} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-semibold">{club} trend</h3>
          <div className="inline-flex bg-surface2 rounded-lg p-[3px] gap-0.5 overflow-x-auto">
            {METRICS.slice(0, 4).map((m) => (
              <button key={m.key} onClick={() => setMetric(m.key)} className={`px-2.5 py-1 rounded-md text-sm font-semibold ${m.key === metric ? "bg-surface text-ink shadow-sm" : "text-ink2"}`}>{m.label}</button>
            ))}
          </div>
        </div>
        <div className="card"><TrendChart rows={rows} metric={metric} /></div>
      </div>
      <SessionTable rows={rows} />
    </div>
  );
}
