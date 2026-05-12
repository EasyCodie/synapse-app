"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Trash2,
  Clock,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StudyMode } from "./study-mode";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  confidence: number;
  subject_id: string | null;
  resource_id: string | null;
  next_review: string | null;
  created_at: string;
}

interface FlashcardSet {
  id: string;
  title: string;
  cards: Flashcard[];
  createdAt: Date;
  dueCount: number;
  masteredCount: number;
  avgConfidence: number;
}

export function FlashcardDeck() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [studyingSet, setStudyingSet] = useState<FlashcardSet | null>(null);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);

  const fetchFlashcards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/flashcards");
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/flashcards");
      if (!cancelled && res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards ?? []);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleRate = useCallback(async (id: string, confidence: number) => {
    await fetch("/api/flashcards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, confidence }),
    });
    setFlashcards((prev) =>
      prev.map((fc) => (fc.id === id ? { ...fc, confidence } : fc))
    );
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/flashcards?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setFlashcards((prev) => prev.filter((fc) => fc.id !== id));
    }
  }, []);

  const handleDeleteSet = useCallback(async (set: FlashcardSet) => {
    for (const card of set.cards) {
      await fetch(`/api/flashcards?id=${card.id}`, { method: "DELETE" });
    }
    setFlashcards((prev) => prev.filter((fc) => !set.cards.some((c) => c.id === fc.id)));
    setExpandedSetId(null);
  }, []);

  // Group cards into sets (created within 60s of each other = same batch)
  const sets = groupIntoSets(flashcards);

  const now = new Date();
  const totalDue = flashcards.filter(
    (fc) => fc.next_review && new Date(fc.next_review) <= now
  ).length;

  // Study mode
  if (studyingSet) {
    return (
      <div className="h-[calc(100vh-120px)] -mx-4 md:-mx-6 lg:-mx-8 -my-6">
        <StudyMode
          cards={studyingSet.cards}
          onRate={handleRate}
          onClose={() => {
            setStudyingSet(null);
            fetchFlashcards();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline text-ink">Flashcards</h1>
          <p className="text-body-sm text-ink-subtle mt-1">
            {sets.length} set{sets.length !== 1 ? "s" : ""} · {flashcards.length} card{flashcards.length !== 1 ? "s" : ""}
            {totalDue > 0 && (
              <span className="ml-2 text-primary">
                · {totalDue} due for review
              </span>
            )}
          </p>
        </div>
        {flashcards.length > 0 && (
          <button
            onClick={() => setStudyingSet({ id: "all", title: "All Cards", cards: flashcards, createdAt: new Date(), dueCount: totalDue, masteredCount: 0, avgConfidence: 0 })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md text-button hover:bg-primary-hover transition-colors duration-200"
          >
            <Play className="w-4 h-4" />
            Study All
          </button>
        )}
      </div>

      {/* Sets grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-surface-1 border border-hairline animate-pulse" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-xl bg-surface-1 border border-hairline flex items-center justify-center mb-4">
            <GraduationCap className="w-7 h-7 text-ink-tertiary" />
          </div>
          <p className="text-body text-ink-subtle">No flashcards yet</p>
          <p className="text-body-sm text-ink-tertiary mt-1 max-w-sm">
            Ask the AI to &ldquo;create flashcards&rdquo; from your uploads and they&apos;ll appear here as study sets
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sets.map((set) => (
            <SetCard
              key={set.id}
              set={set}
              expanded={expandedSetId === set.id}
              onToggle={() => setExpandedSetId(expandedSetId === set.id ? null : set.id)}
              onStudy={() => setStudyingSet(set)}
              onDelete={handleDelete}
              onDeleteSet={() => handleDeleteSet(set)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Set Card ────────────────────────────────────────────────────────────────

function SetCard({
  set,
  expanded,
  onToggle,
  onStudy,
  onDelete,
  onDeleteSet,
}: {
  set: FlashcardSet;
  expanded: boolean;
  onToggle: () => void;
  onStudy: () => void;
  onDelete: (id: string) => void;
  onDeleteSet: () => void;
}) {
  const progressPercent = set.cards.length > 0
    ? (set.masteredCount / set.cards.length) * 100
    : 0;

  return (
    <div className="rounded-lg bg-surface-1 border border-hairline overflow-hidden">
      {/* Set header — always visible */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors duration-200"
      >
        <ChevronRight
          className={cn(
            "w-4 h-4 text-ink-tertiary shrink-0 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />

        {/* Stacked card icon */}
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 rounded bg-surface-3 border border-hairline translate-x-0.5 translate-y-0.5" />
          <div className="absolute inset-0 rounded bg-surface-2 border border-hairline-strong flex items-center justify-center">
            <span className="text-caption font-medium text-ink-muted">{set.cards.length}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-ink truncate">{set.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-caption text-ink-tertiary">
              {set.cards.length} card{set.cards.length !== 1 ? "s" : ""}
            </span>
            {set.dueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-caption text-primary">
                <Clock className="w-3 h-3" />
                {set.dueCount} due
              </span>
            )}
          </div>
        </div>

        {/* Confidence progress bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-caption text-ink-tertiary w-8 text-right">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* Study button */}
        <button
          onClick={(e) => { e.stopPropagation(); onStudy(); }}
          className="shrink-0 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-button hover:bg-primary/20 transition-colors duration-200"
        >
          Study
        </button>
      </div>

      {/* Expanded card list */}
      {expanded && (
        <div className="border-t border-hairline">
          <div className="px-4 py-2 flex items-center justify-between bg-surface-2/30">
            <span className="text-caption text-ink-subtle">
              Created {formatDate(set.createdAt)}
            </span>
            <button
              onClick={onDeleteSet}
              className="text-caption text-ink-tertiary hover:text-red-400 transition-colors duration-200"
            >
              Delete set
            </button>
          </div>
          <div className="divide-y divide-hairline">
            {set.cards.map((card) => (
              <CompactCardRow key={card.id} card={card} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compact Card Row ────────────────────────────────────────────────────────

function CompactCardRow({
  card,
  onDelete,
}: {
  card: Flashcard;
  onDelete: (id: string) => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <div
      onClick={() => setShowAnswer((prev) => !prev)}
      className="group flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-2/30 transition-colors duration-200"
    >
      {/* Confidence dots */}
      <div className="flex items-center gap-0.5 pt-1.5 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1 h-1 rounded-full",
              i < card.confidence ? getConfidenceColor(card.confidence) : "bg-surface-3"
            )}
          />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-body-sm text-ink leading-snug truncate">{card.front}</p>
        {showAnswer && (
          <p className="text-body-sm text-ink-muted mt-1 leading-snug">{card.back}</p>
        )}
      </div>

      {/* Tags */}
      {card.tags.length > 0 && !showAnswer && (
        <span className="hidden sm:inline text-caption text-ink-tertiary bg-surface-2 px-1.5 py-0.5 rounded shrink-0">
          {card.tags[0]}
        </span>
      )}

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-2 text-ink-tertiary hover:text-red-400 transition-all shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupIntoSets(flashcards: Flashcard[]): FlashcardSet[] {
  if (flashcards.length === 0) return [];

  // Sort by created_at descending
  const sorted = [...flashcards].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const sets: FlashcardSet[] = [];
  let currentSet: Flashcard[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].created_at).getTime();
    const currTime = new Date(sorted[i].created_at).getTime();

    // Cards created within 60 seconds of each other belong to same set
    if (Math.abs(prevTime - currTime) <= 60_000) {
      currentSet.push(sorted[i]);
    } else {
      sets.push(buildSet(currentSet));
      currentSet = [sorted[i]];
    }
  }
  sets.push(buildSet(currentSet));

  return sets;
}

function buildSet(cards: Flashcard[]): FlashcardSet {
  const now = new Date();
  const dueCount = cards.filter((c) => c.next_review && new Date(c.next_review) <= now).length;
  const masteredCount = cards.filter((c) => c.confidence >= 4).length;
  const avgConfidence = cards.reduce((sum, c) => sum + c.confidence, 0) / cards.length;

  // Derive title from tags or first card content
  const allTags = cards.flatMap((c) => c.tags);
  const tagCounts = allTags.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const title = topTag
    ? capitalise(topTag)
    : cards[0].front.length > 40
      ? cards[0].front.slice(0, 40) + "…"
      : cards[0].front;

  return {
    id: cards[0].id,
    title,
    cards,
    createdAt: new Date(cards[0].created_at),
    dueCount,
    masteredCount,
    avgConfidence,
  };
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 4) return "bg-semantic-success";
  if (confidence >= 3) return "bg-primary";
  if (confidence >= 2) return "bg-yellow-500";
  if (confidence >= 1) return "bg-orange-500";
  return "bg-red-500";
}
