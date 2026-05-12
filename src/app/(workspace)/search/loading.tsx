export default function SearchLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-pulse">
      {/* Header */}
      <div className="text-center space-y-3 pt-8">
        <div className="h-7 w-24 bg-surface-2 rounded-md mx-auto" />
        <div className="h-4 w-64 bg-surface-2 rounded-md mx-auto" />
      </div>

      {/* Search input */}
      <div className="h-12 bg-surface-1 border border-hairline rounded-md" />

      {/* Suggested queries */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-7 w-28 bg-surface-2 rounded-full" />
        ))}
      </div>
    </div>
  );
}
