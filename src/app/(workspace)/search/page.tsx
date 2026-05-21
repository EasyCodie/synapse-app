"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  FileText,
  Archive,
  BookOpen,
  Sparkles,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

interface SearchResult {
  id: string;
  source_type: "note" | "resource" | "ia";
  source_id: string;
  chunk_index?: number | null;
  content_text: string;
  metadata: {
    title?: string;
    subject_name?: string;
    subject_level?: string;
    chunk_index?: number;
    word_start?: number;
    word_end?: number;
    heading?: string;
    page_label?: string;
    slide_label?: string;
  };
  similarity: number;
}

const SUGGESTED_QUERIES = [
  "Equilibrium",
  "Market failure and externalities",
  "Cell respiration",
  "Integration techniques",
  "TOK knowledge claims",
  "Organic chemistry mechanisms",
];

const SOURCE_CONFIG = {
  note: { icon: FileText, label: "Note", color: "text-blue-400", bg: "bg-blue-500/10" },
  resource: { icon: Archive, label: "Resource", color: "text-primary", bg: "bg-primary/10" },
  ia: { icon: BookOpen, label: "IA", color: "text-emerald-400", bg: "bg-emerald-500/10" },
} as const;

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

  function handleSuggestion(q: string) {
    setQuery(q);
    performSearch(q);
  }

  // Group results by source type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.source_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groupOrder: Array<"resource" | "note" | "ia"> = ["resource", "note", "ia"];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-headline text-ink">Search</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          Find connections across all your subjects with semantic search
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-tertiary pointer-events-none" />
        <input
          type="search"
          placeholder='Search your knowledge — try "Equilibrium" or "market failure"…'
          value={query}
          onChange={handleChange}
          className={cn(
            "w-full pl-12 pr-4 py-3.5 rounded-lg",
            "bg-surface-1 border border-hairline text-ink text-body",
            "placeholder:text-ink-tertiary",
            "focus:border-hairline-strong focus:outline-2 focus:outline-primary/50 focus:outline-offset-0",
            "transition-colors duration-200"
          )}
          autoFocus
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results */}
      {!loading && searched && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="w-12 h-12 rounded-xl bg-surface-1 border border-hairline flex items-center justify-center mx-auto mb-4">
            <Search className="w-6 h-6 text-ink-tertiary" />
          </div>
          <p className="text-body text-ink-subtle">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-body-sm text-ink-tertiary mt-1">
            Try a broader term or upload more resources to expand your knowledge base.
          </p>
        </motion.div>
      )}

      {!loading && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Result count */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-caption text-ink-subtle">
              {results.length} result{results.length !== 1 ? "s" : ""} found across your workspace
            </span>
          </div>

          {/* Grouped results */}
          {groupOrder.map((type) => {
            const group = grouped[type];
            if (!group || group.length === 0) return null;
            const config = SOURCE_CONFIG[type];

            return (
              <div key={type}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2">
                  <config.icon className={cn("w-3.5 h-3.5", config.color)} />
                  <span className="text-eyebrow text-ink-subtle">
                    {config.label}s
                  </span>
                  <span className="text-caption text-ink-tertiary">({group.length})</span>
                </div>

                {/* Result cards */}
                <div className="space-y-1.5">
                  {group.map((result, i) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                    >
                      <ResultCard result={result} />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Empty state with suggestions */}
      {!searched && (
        <div className="space-y-8">
          {/* How it works */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-surface-1 border border-hairline">
            <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-body-sm text-ink">Semantic search, not keyword matching</p>
              <p className="text-caption text-ink-subtle mt-0.5">
                Search by meaning — &ldquo;Equilibrium&rdquo; finds Chemistry, Economics, and Physics results simultaneously.
              </p>
            </div>
          </div>

          {/* Suggested queries */}
          <div>
            <p className="text-caption text-ink-subtle mb-3">Try searching for</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-1 border border-hairline text-body-sm text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors duration-200"
                >
                  <Search className="w-3 h-3 text-ink-tertiary" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: SearchResult }) {
  const config = SOURCE_CONFIG[result.source_type];
  const Icon = config.icon;
  const chunkIndex =
    typeof result.metadata.chunk_index === "number"
      ? result.metadata.chunk_index
      : result.chunk_index;

  const href =
    result.source_type === "resource"
      ? resourceHref(result.source_id, chunkIndex)
      : result.source_type === "ia"
        ? "/ia-manager"
        : "/subjects";

  const similarity = Math.round(result.similarity * 100);
  const location = resourceLocationLabel(result);

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 px-4 py-3 rounded-lg bg-surface-1 border border-hairline hover:border-hairline-strong hover:bg-surface-2/30 transition-colors duration-200"
    >
      {/* Icon */}
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
        <Icon className={cn("w-3.5 h-3.5", config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-body-sm font-medium text-ink truncate">
            {result.metadata.title ?? "Untitled"}
          </span>
          {result.metadata.subject_name && (
            <span className="text-caption px-1.5 py-0.5 bg-surface-3 text-ink-subtle rounded shrink-0">
              {result.metadata.subject_name}
              {result.metadata.subject_level && ` ${result.metadata.subject_level}`}
            </span>
          )}
          {location && (
            <span className="hidden shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-caption text-ink-subtle sm:inline">
              {location}
            </span>
          )}
        </div>
        <p className="text-caption text-ink-subtle line-clamp-2 leading-relaxed">
          {result.content_text}
        </p>
      </div>

      {/* Similarity + arrow */}
      <div className="flex items-center gap-2 shrink-0 mt-1">
        <MatchBadge similarity={similarity} />
        <ArrowRight className="w-3.5 h-3.5 text-ink-tertiary transition-colors group-hover:text-ink-subtle" />
      </div>
    </Link>
  );
}

function resourceHref(sourceId: string, chunkIndex: number | null | undefined) {
  if (typeof chunkIndex !== "number") {
    return `/resources/${sourceId}`;
  }

  return `/resources/${sourceId}?chunk=${chunkIndex}#chunk-${chunkIndex}`;
}

function resourceLocationLabel(result: SearchResult) {
  if (result.source_type !== "resource") return null;
  const metadata = result.metadata;

  if (metadata.heading) return metadata.heading;
  if (metadata.page_label) return metadata.page_label;
  if (metadata.slide_label) return metadata.slide_label;

  const chunkIndex =
    typeof metadata.chunk_index === "number"
      ? metadata.chunk_index
      : result.chunk_index;
  if (typeof chunkIndex === "number") return `Chunk ${chunkIndex + 1}`;

  return null;
}

function MatchBadge({ similarity }: { similarity: number }) {
  const color =
    similarity >= 80
      ? "text-semantic-success bg-semantic-success/10"
      : similarity >= 60
        ? "text-primary bg-primary/10"
        : "text-ink-subtle bg-surface-3";

  return (
    <span className={cn("text-caption px-1.5 py-0.5 rounded font-medium", color)}>
      {similarity}%
    </span>
  );
}
