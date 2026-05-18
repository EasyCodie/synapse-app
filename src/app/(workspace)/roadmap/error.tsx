"use client";

export default function RoadmapError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-6">
      <h1 className="text-card-title text-ink">Roadmap could not load</h1>
      <p className="mt-2 text-body-sm text-ink-subtle">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-primary px-3 py-2 text-button text-on-primary transition-colors hover:bg-primary-hover"
      >
        Retry
      </button>
    </div>
  );
}
