"use client";

import { useState, useCallback } from "react";
import { RotateCcw, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { level: 0, label: "Again", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { level: 1, label: "Hard", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { level: 2, label: "Okay", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { level: 3, label: "Good", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { level: 4, label: "Easy", color: "bg-primary/20 text-primary border-primary/30" },
  { level: 5, label: "Perfect", color: "bg-semantic-success/20 text-semantic-success border-semantic-success/30" },
];

export function StudyMode({ cards, onRate, onClose }: StudyModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rating, setRating] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

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
      setRating(false);

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setFlipped(false);
      } else {
        onClose();
      }
    },
    [currentCard, currentIndex, cards.length, onRate, onClose]
  );

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setFlipped(false);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setFlipped(false);
    }
  }, [currentIndex, cards.length]);

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
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-2 text-ink-subtle hover:text-ink transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="text-body-sm text-ink-subtle">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            className="p-1.5 rounded-md hover:bg-surface-2 text-ink-subtle hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNext}
            disabled={currentIndex === cards.length - 1}
            className="p-1.5 rounded-md hover:bg-surface-2 text-ink-subtle hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-surface-2">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          onClick={handleFlip}
          className="relative w-full max-w-lg cursor-pointer perspective-1000"
        >
          <div
            className={cn(
              "relative w-full min-h-[280px] transition-transform duration-500 transform-style-preserve-3d",
              flipped && "rotate-y-180"
            )}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden rounded-lg bg-surface-1 border border-hairline p-8 flex flex-col items-center justify-center">
              <p className="text-eyebrow text-ink-tertiary mb-4">QUESTION</p>
              <p className="text-card-title text-ink text-center leading-relaxed">
                {currentCard.front}
              </p>
              <p className="text-caption text-ink-tertiary mt-6 flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" />
                Tap to flip
              </p>
            </div>

            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-lg bg-surface-2 border border-hairline-strong p-8 flex flex-col items-center justify-center">
              <p className="text-eyebrow text-primary mb-4">ANSWER</p>
              <p className="text-body-lg text-ink text-center leading-relaxed">
                {currentCard.back}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons — only visible when flipped */}
      {flipped && (
        <div className="px-4 py-4 border-t border-hairline">
          <p className="text-caption text-ink-subtle text-center mb-3">
            How well did you know this?
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {CONFIDENCE_LABELS.map((conf) => (
              <button
                key={conf.level}
                onClick={() => handleRate(conf.level)}
                disabled={rating}
                className={cn(
                  "px-3 py-1.5 rounded-md text-button border transition-colors disabled:opacity-50",
                  conf.color,
                  "hover:opacity-80"
                )}
              >
                {conf.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
