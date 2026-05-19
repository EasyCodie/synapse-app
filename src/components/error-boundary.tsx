"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const technicalDetail = error.message || error.digest;

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-ink-subtle" />
      </div>
      <h2 className="text-card-title text-ink mb-2">Something went wrong</h2>
      <p className="text-body-sm text-ink-subtle mb-6 text-center max-w-md">
        Synapse could not finish loading this view. Try again, or come back to
        the workspace from the sidebar.
      </p>
      {technicalDetail && (
        <details className="mb-6 max-w-md rounded-md border border-hairline bg-surface-1 px-3 py-2 text-caption text-ink-tertiary">
          <summary className="cursor-pointer text-ink-subtle">
            Technical detail
          </summary>
          <p className="mt-2 break-words">{technicalDetail}</p>
        </details>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-on-primary rounded-md text-button hover:bg-primary-hover transition-colors duration-200"
      >
        Try again
      </button>
    </div>
  );
}
