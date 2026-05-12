export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-3 w-32 bg-surface-2 rounded-md mb-2" />
        <div className="h-7 w-56 bg-surface-2 rounded-md" />
        <div className="h-4 w-40 bg-surface-2 rounded-md mt-2" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-3">
            <div className="h-3 w-20 bg-surface-2 rounded-md" />
            <div className="h-7 w-12 bg-surface-2 rounded-md" />
            <div className="h-3 w-16 bg-surface-2 rounded-md" />
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-4">
          <div className="h-5 w-36 bg-surface-2 rounded-md" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-surface-2 rounded-md" />
          ))}
        </div>
        <div className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-4">
          <div className="h-5 w-28 bg-surface-2 rounded-md" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-surface-2 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
