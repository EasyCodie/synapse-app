export default function TOKLoading() {
  return (
    <div className="space-y-6 max-w-2xl animate-pulse">
      <div>
        <div className="h-3 w-32 bg-surface-2 rounded-md mb-2" />
        <div className="h-7 w-48 bg-surface-2 rounded-md" />
      </div>
      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
        <div className="h-5 w-20 bg-surface-2 rounded-md" />
        <div className="h-4 w-full bg-surface-2 rounded-md" />
        <div className="h-4 w-3/4 bg-surface-2 rounded-md" />
      </div>
      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
        <div className="h-5 w-28 bg-surface-2 rounded-md" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 bg-surface-2 rounded-md" />
        ))}
      </div>
    </div>
  );
}
