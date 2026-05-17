"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ChevronLeft, ChevronRight, X, Trophy, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlashcardMarkdown } from "./flashcard-markdown";

interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  confidence: number;
  next_review: string | null;
}

interface StudyModeProps {
  cards: Flashcard[];
  onRate: (id: string, confidence: number) => Promise<void>;
  onClose: () => void;
}

const CONFIDENCE_LABELS = [
  { level: 0, label: "Again", color: "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-red-500/25" },
  { level: 1, label: "Hard", color: "bg-orange-500/15 text-orange-400 border-orange-500/25 hover:bg-orange-500/25" },
  { level: 2, label: "Okay", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/25" },
  { level: 3, label: "Good", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25" },
  { level: 4, label: "Easy", color: "bg-primary/15 text-primary border-primary/25 hover:bg-primary/25" },
  { level: 5, label: "Perfect", color: "bg-semantic-success/15 text-semantic-success border-semantic-success/25 hover:bg-semantic-success/20" },
];

interface SessionResult {
  cardId: string;
  confidence: number;
}

export function StudyMode({ cards, onRate, onClose }: StudyModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(false);
  const [direction, setDirection] = useState(0); // -1 = prev, 1 = next
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex) / cards.length) * 100 : 0;

  const handleFlip = useCallback(() => {
    if (!rating) {
      setFlipped((prev) => !prev);
    }
  }, [rating]);

  const handleRate = useCallback(
    async (confidence: number) => {
      if (!currentCard) return;
      setRating(true);
      await onRate(currentCard.id, confidence);
      setSessionResults((prev) => [...prev, { cardId: currentCard.id, confidence }]);
      setRating(false);

      // Move to next card or show summary
      if (currentIndex < cards.length - 1) {
        setDirection(1);
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
      } else {
        setShowSummary(true);
      }
    },
    [currentCard, currentIndex, cards.length, onRate]
  );

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
      setFlipped(false);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
      setFlipped(false);
    }
  }, [currentIndex, cards.length]);

  // Session summary screen
  if (showSummary) {
    return <SessionSummary results={sessionResults} total={cards.length} onClose={onClose} />;
  }

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-ink-subtle text-body">No cards to study.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-md hover:bg-surface-2 text-ink-subtle hover:text-ink transition-colors duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </motion.button>
          <span className="text-body-sm text-ink-muted tabular-nums">
            <span className="text-ink font-medium">{currentIndex + 1}</span>
            <span className="text-ink-tertiary"> / {cards.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-md hover:bg-surface-2 text-ink-subtle hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNext}
            disabled={currentIndex === cards.length - 1}
            className="p-2 rounded-md hover:bg-surface-2 text-ink-subtle hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface-2">
        <motion.div
          className="h-full bg-primary"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.2 }}
            onClick={handleFlip}
            className="relative w-full max-w-lg cursor-pointer"
            style={{ perspective: 1000 }}
          >
            <motion.div
              className="relative w-full min-h-[300px]"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 25 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 rounded-xl bg-surface-1 border border-hairline p-8 flex flex-col items-center justify-center"
                style={{ backfaceVisibility: "hidden" }}
              >
                <p className="text-eyebrow text-ink-tertiary mb-5">QUESTION</p>
                <FlashcardMarkdown content={currentCard.front} tone="question" className="max-w-md" />
                {currentCard.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-6">
                    {currentCard.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-caption text-ink-tertiary bg-surface-2 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-caption text-ink-tertiary mt-6 flex items-center gap-1.5 opacity-60">
                  <RotateCcw className="w-3 h-3" />
                  Tap to reveal answer
                </p>
              </div>

              {/* Back */}
              <div
                className="absolute inset-0 rounded-xl bg-surface-2 border border-hairline-strong p-8 flex flex-col items-center justify-center"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <p className="text-eyebrow text-primary mb-5">ANSWER</p>
                <FlashcardMarkdown content={currentCard.back} tone="answer" className="max-w-md" />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rating buttons — only visible when flipped */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="px-4 py-5 border-t border-hairline"
          >
            <p className="text-caption text-ink-subtle text-center mb-3">
              How well did you know this?
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {CONFIDENCE_LABELS.map((conf) => (
                <motion.button
                  key={conf.level}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleRate(conf.level)}
                  disabled={rating}
                  className={cn(
                    "px-3.5 py-2 rounded-md text-button border transition-colors duration-200 disabled:opacity-50 min-h-[36px]",
                    conf.color
                  )}
                >
                  {conf.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Session Summary ─────────────────────────────────────────────────────────

function SessionSummary({
  results,
  total,
  onClose,
}: {
  results: SessionResult[];
  total: number;
  onClose: () => void;
}) {
  const reviewed = results.length;
  const avgConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    : 0;
  const perfectCount = results.filter((r) => r.confidence >= 4).length;
  const needsWorkCount = results.filter((r) => r.confidence <= 1).length;

  const performanceLabel = avgConfidence >= 4 ? "Excellent!" : avgConfidence >= 3 ? "Great work!" : avgConfidence >= 2 ? "Good effort!" : "Keep practicing!";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6"
      >
        <Trophy className="w-8 h-8 text-primary" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-headline text-ink mb-2"
      >
        {performanceLabel}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-body-sm text-ink-subtle mb-8"
      >
        You reviewed {reviewed} of {total} card{total !== 1 ? "s" : ""}
      </motion.p>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4 max-w-sm w-full mb-8"
      >
        <div className="bg-surface-1 border border-hairline rounded-lg p-4">
          <p className="text-headline text-ink">{avgConfidence.toFixed(1)}</p>
          <p className="text-caption text-ink-tertiary mt-1">Avg score</p>
        </div>
        <div className="bg-surface-1 border border-hairline rounded-lg p-4">
          <p className="text-headline text-semantic-success">{perfectCount}</p>
          <p className="text-caption text-ink-tertiary mt-1">Mastered</p>
        </div>
        <div className="bg-surface-1 border border-hairline rounded-lg p-4">
          <p className="text-headline text-ink">{needsWorkCount}</p>
          <p className="text-caption text-ink-tertiary mt-1">Needs work</p>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClose}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-md text-button hover:bg-primary-hover transition-colors duration-200"
      >
        Done
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
