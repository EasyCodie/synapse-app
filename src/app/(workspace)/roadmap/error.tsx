"use client";

export default function RoadmapError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const technicalDetail = error.message;

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-6">
      <h1 className="text-card-title text-ink">Roadmap could not load</h1>
      <p className="mt-2 text-body-sm text-ink-subtle">
        Synapse could not load your focus plan. Retry to rebuild the view from
        your saved roadmap data.
      </p>
      {technicalDetail && (
        <details className="mt-3 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-caption text-ink-tertiary">
          <summary className="cursor-pointer text-ink-subtle">
            Technical detail
          </summary>
          <p className="mt-2 break-words">{technicalDetail}</p>
        </details>
      )}
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
