export default function CoreLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-24 bg-surface-2 rounded-md" />
        <div className="h-4 w-64 bg-surface-2 rounded-md mt-2" />
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 bg-surface-2 rounded-md" />
              <div className="h-5 w-16 bg-surface-2 rounded-full" />
            </div>
            <div className="h-5 w-36 bg-surface-2 rounded-md" />
            <div className="h-4 w-full bg-surface-2 rounded-md" />
            <div className="h-1 bg-surface-2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
