export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl animate-pulse">
      <div className="h-7 w-32 bg-surface-2 rounded-md" />
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
            <div className="h-4 w-24 bg-surface-2 rounded-md" />
            <div className="h-10 w-full bg-surface-2 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
