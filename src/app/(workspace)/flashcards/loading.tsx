export default function FlashcardsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-7 w-32 bg-surface-2 rounded-md" />
          <div className="h-4 w-48 bg-surface-2 rounded-md mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
            <div className="h-5 w-3/4 bg-surface-2 rounded-md" />
            <div className="h-3 w-1/2 bg-surface-2 rounded-md" />
            <div className="h-2 w-full bg-surface-2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
