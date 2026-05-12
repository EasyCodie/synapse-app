export default function SubjectDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-3 w-20 bg-surface-2 rounded-md mb-2" />
        <div className="h-7 w-48 bg-surface-2 rounded-md" />
        <div className="h-4 w-24 bg-surface-2 rounded-md mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
            <div className="h-5 w-32 bg-surface-2 rounded-md" />
            <div className="h-4 w-full bg-surface-2 rounded-md" />
            <div className="h-4 w-2/3 bg-surface-2 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
