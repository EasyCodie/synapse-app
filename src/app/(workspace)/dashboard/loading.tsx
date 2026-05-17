export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 w-44 bg-surface-2 rounded-sm" />
          <div className="h-3 w-56 bg-surface-2 rounded-sm mt-1.5" />
        </div>
        <div className="flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-7 w-20 bg-surface-2 rounded-md border border-hairline" />
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-hairline bg-canvas px-4 py-3 space-y-2">
            <div className="h-3 w-16 bg-surface-2 rounded-sm" />
            <div className="h-4 w-8 bg-surface-2 rounded-sm" />
            <div className="h-2.5 w-14 bg-surface-2 rounded-sm" />
          </div>
        ))}
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-lg border border-hairline bg-canvas">
            <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
              <div className="h-3.5 w-24 bg-surface-2 rounded-sm" />
              <div className="h-3 w-14 bg-surface-2 rounded-sm" />
            </div>
            <div className="px-4 py-2 space-y-0">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center gap-2.5 py-2 border-b border-hairline/40 last:border-0">
                  <div className="w-2 h-2 bg-surface-2 rounded-full" />
                  <div className="h-3.5 flex-1 bg-surface-2 rounded-sm" />
                  <div className="h-3 w-12 bg-surface-2 rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Subjects panel */}
      <div className="rounded-lg border border-hairline bg-canvas">
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <div className="h-3.5 w-16 bg-surface-2 rounded-sm" />
          <div className="h-3 w-14 bg-surface-2 rounded-sm" />
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-7 w-28 bg-surface-2 rounded-md border border-hairline" />
          ))}
        </div>
      </div>
    </div>
  );
}
