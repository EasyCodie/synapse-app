"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-ink-subtle" />
      </div>
      <h2 className="text-card-title text-ink mb-2">Something went wrong</h2>
      <p className="text-body-sm text-ink-subtle mb-6 text-center max-w-md">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-on-primary rounded-md text-button hover:bg-primary-hover transition-colors duration-200"
      >
        Try again
      </button>
    </div>
  );
}
