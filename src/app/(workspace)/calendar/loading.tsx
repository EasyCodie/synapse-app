export default function CalendarLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-surface-2 rounded-md" />
          <div className="h-4 w-24 bg-surface-2 rounded-md mt-2" />
        </div>
        <div className="h-10 w-28 bg-surface-2 rounded-md" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-surface-1 border border-hairline rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-32 bg-surface-2 rounded-md" />
            <div className="flex gap-1">
              <div className="w-9 h-9 bg-surface-2 rounded-md" />
              <div className="w-9 h-9 bg-surface-2 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-11 bg-surface-2/50 rounded-md" />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-3">
            <div className="h-4 w-20 bg-surface-2 rounded-md" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-surface-2 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
