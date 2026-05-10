"use client";

import { useState, useCallback } from "react";
import { Search, FileText, Archive, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

interface SearchResult {
  id: string;
  source_type: "note" | "resource" | "ia";
  source_id: string;
  content_text: string;
  metadata: {
    title?: string;
    subject_name?: string;
    subject_level?: string;
  };
  similarity: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json() as { results: SearchResult[] };
        setResults(data.results ?? []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebouncedCallback(performSearch, 400);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    debouncedSearch(val);
  }

  const sourceIcon = {
    note: FileText,
    resource: Archive,
    ia: BookOpen,
  };

  const sourceLabel = {
    note: "Note",
    resource: "Resource",
    ia: "IA",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-headline text-ink">Search</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          Semantic search across all your notes, resources, and IAs
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" />
        <Input
          type="search"
          placeholder='Try "Equilibrium" or "market failure"…'
          value={query}
          onChange={handleChange}
          className={cn(
            "pl-9 bg-surface-1 border-hairline text-ink placeholder:text-ink-tertiary",
            "focus:border-hairline-strong focus:ring-0 focus:outline-2 focus:outline-primary/50",
            "h-11 text-body"
          )}
          autoFocus
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface-1 border border-hairline rounded-md animate-pulse" />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-8 h-8 text-ink-tertiary mx-auto mb-3" />
          <p className="text-body-sm text-ink-subtle">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-caption text-ink-tertiary mt-1">
            Try a different term or add more notes and resources.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption text-ink-subtle">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((result) => {
            const Icon = sourceIcon[result.source_type];
            const label = sourceLabel[result.source_type];
            const href =
              result.source_type === "note"
                ? `/subjects/${result.metadata.subject_name ?? ""}`
                : result.source_type === "resource"
                ? "/resources"
                : "/ia-manager";

            return (
              <a
                key={result.id}
                href={href}
                className="flex items-start gap-3 px-4 py-3 bg-surface-1 border border-hairline rounded-md hover:border-hairline-strong transition-colors"
              >
                <div className="w-8 h-8 rounded-md bg-surface-3 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-ink-subtle" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-body-sm text-ink font-medium truncate">
                      {result.metadata.title ?? "Untitled"}
                    </span>
                    <span className="text-caption px-1.5 py-0.5 bg-surface-3 text-ink-subtle rounded-sm shrink-0">
                      {label}
                    </span>
                    {result.metadata.subject_name && (
                      <span className="text-caption text-ink-subtle shrink-0">
                        {result.metadata.subject_name}
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-ink-subtle line-clamp-2">
                    {result.content_text}
                  </p>
                </div>
                <span className="text-caption text-ink-tertiary shrink-0">
                  {Math.round(result.similarity * 100)}%
                </span>
              </a>
            );
          })}
        </div>
      )}

      {!searched && (
        <div className="text-center py-12">
          <p className="text-body-sm text-ink-subtle">
            Search finds connections across all your subjects simultaneously.
          </p>
          <p className="text-caption text-ink-tertiary mt-1">
            Powered by semantic similarity — not just keyword matching.
          </p>
        </div>
      )}
    </div>
  );
}
