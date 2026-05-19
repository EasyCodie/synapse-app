"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Trash2,
  Clock,
  ChevronRight,
  GraduationCap,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlashcardMarkdown } from "./flashcard-markdown";
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

const setCardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.25 },
  }),
};

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

  // Confidence distribution
  const distribution = getConfidenceDistribution(flashcards);

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
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setStudyingSet({ id: "all", title: "All Cards", cards: flashcards, createdAt: new Date(), dueCount: totalDue, masteredCount: 0, avgConfidence: 0 })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md text-button hover:bg-primary-hover transition-colors duration-200"
          >
            <Play className="w-4 h-4" />
            Study All
          </motion.button>
        )}
      </div>

      {/* Stats bar — confidence distribution + due badge */}
      {flashcards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-surface-1 border border-hairline rounded-lg"
        >
          {/* Confidence distribution */}
          <div className="flex-1">
            <p className="text-caption text-ink-tertiary mb-2">Confidence Distribution</p>
            <div className="flex items-center h-2 rounded-full overflow-hidden bg-surface-3">
              {distribution.map((seg) => (
                <motion.div
                  key={seg.level}
                  initial={{ width: 0 }}
                  animate={{ width: `${seg.percent}%` }}
                  transition={{ duration: 0.5, delay: seg.level * 0.05 }}
                  className={cn("h-full", seg.color)}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              {distribution.filter((s) => s.percent > 0).map((seg) => (
                <span key={seg.level} className="flex items-center gap-1 text-[11px] text-ink-tertiary">
                  <span className={cn("w-2 h-2 rounded-sm", seg.color)} />
                  {seg.label} ({seg.count})
                </span>
              ))}
            </div>
          </div>

          {/* Due for review */}
          {totalDue > 0 && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                const dueCards = flashcards.filter(
                  (fc) => fc.next_review && new Date(fc.next_review) <= now
                );
                setStudyingSet({
                  id: "due",
                  title: "Due for Review",
                  cards: dueCards,
                  createdAt: new Date(),
                  dueCount: dueCards.length,
                  masteredCount: 0,
                  avgConfidence: 0,
                });
              }}
              className="flex items-center gap-3 px-4 py-3 bg-primary/8 border border-primary/15 rounded-lg hover:bg-primary/12 transition-colors duration-200 shrink-0"
            >
              <div className="w-9 h-9 rounded-md bg-primary/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-body-sm font-medium text-ink">{totalDue} due</p>
                <p className="text-[11px] text-ink-subtle">Review now</p>
              </div>
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Sets list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-1 border border-hairline animate-shimmer" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-14 h-14 rounded-xl bg-surface-1 border border-hairline flex items-center justify-center mb-4">
            <GraduationCap className="w-7 h-7 text-ink-tertiary" />
          </div>
          <p className="text-body text-ink-subtle">No flashcards yet</p>
          <p className="text-body-sm text-ink-tertiary mt-1 max-w-sm">
            Ask Advisor to create flashcards from your uploads and they&apos;ll appear here as study sets
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sets.map((set, i) => (
            <motion.div
              key={set.id}
              custom={i}
              variants={setCardVariants}
              initial="hidden"
              animate="visible"
            >
              <SetCard
                set={set}
                expanded={expandedSetId === set.id}
                onToggle={() => setExpandedSetId(expandedSetId === set.id ? null : set.id)}
                onStudy={() => setStudyingSet(set)}
                onDelete={handleDelete}
                onDeleteSet={() => handleDeleteSet(set)}
              />
            </motion.div>
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
    <div className="rounded-lg bg-surface-1 border border-hairline overflow-hidden hover:border-hairline-strong transition-colors duration-200">
      {/* Set header — always visible */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-5 py-4 cursor-pointer"
      >
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4 text-ink-tertiary shrink-0" />
        </motion.div>

        {/* Stacked card icon */}
        <div className="relative w-9 h-9 shrink-0">
          <div className="absolute inset-0 rounded-md bg-surface-3 border border-hairline translate-x-0.5 translate-y-0.5" />
          <div className="absolute inset-0 rounded-md bg-surface-2 border border-hairline-strong flex items-center justify-center">
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
            {set.masteredCount > 0 && (
              <span className="text-caption text-semantic-success">
                {set.masteredCount} mastered
              </span>
            )}
          </div>
        </div>

        {/* Confidence bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-24 h-2 rounded-full bg-surface-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-caption text-ink-tertiary w-8 text-right tabular-nums">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* Study button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onStudy(); }}
          className="shrink-0 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-button hover:bg-primary/20 transition-colors duration-200"
        >
          Study
        </motion.button>
      </div>

      {/* Expanded card list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline">
              <div className="px-5 py-2.5 flex items-center justify-between bg-surface-2/30">
                <span className="text-caption text-ink-subtle">
                  Created {formatDate(set.createdAt)}
                </span>
                <button
                  onClick={onDeleteSet}
                  className="text-caption text-ink-tertiary hover:text-red-400 transition-colors duration-200 px-2 py-1 rounded hover:bg-surface-2"
                >
                  Delete set
                </button>
              </div>
              <div className="divide-y divide-hairline">
                {set.cards.map((card, i) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <CompactCardRow card={card} onDelete={onDelete} />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      className="group flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors duration-200 hover:bg-surface-2/30 focus-within:bg-surface-2/30"
    >
      {/* Confidence indicator */}
      <div className="flex items-center gap-0.5 pt-1.5 shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              i < card.confidence ? getConfidenceColor(card.confidence) : "bg-surface-3"
            )}
          />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <FlashcardMarkdown content={card.front} tone="compact" />
        <AnimatePresence>
          {showAnswer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-1.5 overflow-hidden"
            >
              <FlashcardMarkdown content={card.back} tone="compact-muted" />
            </motion.div>
          )}
        </AnimatePresence>
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
        type="button"
        aria-label="Delete flashcard"
        className="shrink-0 rounded-md border border-hairline bg-surface-2/60 p-1.5 text-ink-tertiary transition-colors duration-200 hover:border-hairline-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-primary/50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupIntoSets(flashcards: Flashcard[]): FlashcardSet[] {
  if (flashcards.length === 0) return [];

  const sorted = [...flashcards].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const sets: FlashcardSet[] = [];
  let currentSet: Flashcard[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(sorted[i - 1].created_at).getTime();
    const currTime = new Date(sorted[i].created_at).getTime();

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

function getConfidenceDistribution(flashcards: Flashcard[]) {
  if (flashcards.length === 0) return [];
  const levels = [
    { level: 0, label: "New", color: "bg-ink-tertiary", count: 0 },
    { level: 1, label: "Hard", color: "bg-red-500", count: 0 },
    { level: 2, label: "Okay", color: "bg-yellow-500", count: 0 },
    { level: 3, label: "Good", color: "bg-primary", count: 0 },
    { level: 4, label: "Easy", color: "bg-primary-hover", count: 0 },
    { level: 5, label: "Mastered", color: "bg-semantic-success", count: 0 },
  ];

  for (const fc of flashcards) {
    const lvl = Math.min(Math.max(fc.confidence, 0), 5);
    levels[lvl].count++;
  }

  return levels.map((l) => ({
    ...l,
    percent: (l.count / flashcards.length) * 100,
  }));
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
