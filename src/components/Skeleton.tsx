/** Instant placeholder shown while a page's data loads, so a tab tap responds at once. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <div className="mb-5">
        <div className="h-3 w-24 rounded bg-surface2 mb-2" />
        <div className="h-7 w-44 rounded bg-surface2" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-surface2 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block h-4 w-2/5 rounded bg-surface2 mb-2" />
              <span className="block h-3 w-3/5 rounded bg-surface2" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
