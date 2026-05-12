export default function ResourcesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="h-7 w-36 bg-surface-2 rounded-md" />
          <div className="h-4 w-24 bg-surface-2 rounded-md mt-2" />
        </div>
        <div className="h-10 w-28 bg-surface-2 rounded-md" />
      </div>

      {/* Resource rows */}
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 bg-surface-1 border border-hairline rounded-lg">
            <div className="w-8 h-8 bg-surface-2 rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 bg-surface-2 rounded-md" />
              <div className="h-3 w-32 bg-surface-2 rounded-md" />
            </div>
            <div className="h-5 w-12 bg-surface-2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
