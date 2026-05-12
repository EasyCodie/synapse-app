export default function ChatLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="h-7 w-40 bg-surface-2 rounded-md mb-6" />
      <div className="flex-1 space-y-4 py-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
            <div className={`h-16 ${i % 2 === 0 ? "w-2/3" : "w-1/2"} bg-surface-2 rounded-lg`} />
          </div>
        ))}
      </div>
      <div className="h-12 bg-surface-2 rounded-lg" />
    </div>
  );
}
