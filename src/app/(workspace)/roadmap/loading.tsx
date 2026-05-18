export default function RoadmapLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-36 animate-pulse rounded-md bg-surface-2" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-lg border border-hairline bg-surface-1"
          />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-lg border border-hairline bg-surface-1" />
    </div>
  );
}
