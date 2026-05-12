export default function IAManagerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-32 bg-surface-2 rounded-md" />
        <div className="h-4 w-48 bg-surface-2 rounded-md mt-2" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-surface-2 rounded-md" />
              <div className="h-3 w-4 bg-surface-2 rounded-md" />
            </div>
            <div className="space-y-2">
              {[...Array(i < 3 ? 2 : 1)].map((_, j) => (
                <div key={j} className="bg-surface-1 border border-hairline rounded-lg p-4 space-y-2">
                  <div className="h-4 w-24 bg-surface-2 rounded-md" />
                  <div className="h-3 w-32 bg-surface-2 rounded-md" />
                  <div className="h-1 bg-surface-2 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
