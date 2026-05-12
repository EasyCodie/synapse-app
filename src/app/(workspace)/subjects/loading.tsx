export default function SubjectsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-28 bg-surface-2 rounded-md" />
        <div className="h-4 w-44 bg-surface-2 rounded-md mt-2" />
      </div>

      {/* Subject cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-hairline rounded-lg p-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 bg-surface-2 rounded-md" />
              <div className="h-5 w-8 bg-surface-2 rounded-full" />
            </div>
            <div className="h-5 w-32 bg-surface-2 rounded-md" />
            <div className="h-3 w-16 bg-surface-2 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
