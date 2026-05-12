export default function EELoading() {
  return (
    <div className="space-y-6 max-w-2xl animate-pulse">
      <div>
        <div className="h-3 w-32 bg-surface-2 rounded-md mb-2" />
        <div className="h-7 w-40 bg-surface-2 rounded-md" />
      </div>
      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-surface-2 rounded-md" />
              <div className="h-5 w-24 bg-surface-2 rounded-md" />
            </div>
          ))}
        </div>
        <div className="h-1.5 w-full bg-surface-2 rounded-full" />
      </div>
    </div>
  );
}
