"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { SubjectSelection } from "@/lib/workspace-generator";
import { Button } from "@/components/ui/button";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { cn } from "@/lib/utils";
import examSessions from "@/data/exam-sessions.json";
import ibSubjects from "@/data/ib-subjects.json";
import { Sparkles } from "lucide-react";

type Step = "session" | "subjects" | "review";

const steps: Array<{
  id: Step;
  label: string;
  description: string;
}> = [
  {
    id: "session",
    label: "Exam session",
    description: "Anchor the academic timeline.",
  },
  {
    id: "subjects",
    label: "Subjects",
    description: "Select 3 HL and 3 SL courses.",
  },
  {
    id: "review",
    label: "Review",
    description: "Confirm the generated workspace.",
  },
];

const stepCopy = {
  session: {
    title: "When are your exams?",
    description:
      "Synapse will build your 2-year academic timeline around your exam session.",
  },
  subjects: {
    title: "Choose your 6 subjects",
    description:
      "Select 3 HL and 3 SL subjects. Synapse will generate your IA folders, syllabus checklists, and past paper trackers.",
  },
  review: {
    title: "Your workspace is ready",
    description: "Review your selections before we generate your workspace.",
  },
} satisfies Record<Step, { title: string; description: string }>;

const easeOutQuart = [0.25, 1, 0.5, 1] as [
  number,
  number,
  number,
  number,
];

interface SubjectGroup {
  group: number;
  groupName: string;
  subjects: Array<{
    id: string;
    name: string;
    availableLevels: string[];
  }>;
}

const CHECKLIST_ITEMS = [
  { id: "database", label: "Initializing personal database" },
  { id: "scaffold", label: "Scaffolding Extended Essay, TOK & CAS" },
  { id: "subjects", label: "Creating subject-specific IA directories" },
  { id: "syllabus", label: "Populating checklists & trackers" },
  { id: "search", label: "Configuring local semantic search index" },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isResetMode = searchParams.get("reset") === "1";
  const [step, setStep] = useState<Step>("session");
  const [examSession, setExamSession] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<
    SubjectSelection[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workspace building states
  const [isBuilding, setIsBuilding] = useState(false);
  const [activeChecklistIndex, setActiveChecklistIndex] = useState(0);
  const [apiFinished, setApiFinished] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const savingRef = useRef(false);
  const hasHydrated = useHasHydrated();
  const shouldAnimate = hasHydrated;

  const groups = ibSubjects as SubjectGroup[];

  function toggleSubject(
    subjectId: string,
    subjectName: string,
    group: number,
    level: "HL" | "SL"
  ) {
    setSelectedSubjects((prev) => {
      const existing = prev.find((s) => s.id === subjectId);
      if (existing) {
        if (existing.level === level) {
          return prev.filter((s) => s.id !== subjectId);
        }
        return prev.map((s) => (s.id === subjectId ? { ...s, level } : s));
      }

      return [
        ...prev,
        { id: subjectId, name: subjectName, group, level, language: "English" },
      ];
    });
  }

  function isSelected(subjectId: string, level?: "HL" | "SL") {
    const subject = selectedSubjects.find((s) => s.id === subjectId);
    if (!subject) return false;
    if (level) return subject.level === level;
    return true;
  }

  const hlCount = selectedSubjects.filter((s) => s.level === "HL").length;
  const slCount = selectedSubjects.filter((s) => s.level === "SL").length;
  const totalCount = selectedSubjects.length;
  const isValidSelection = hlCount >= 3 && slCount >= 3 && totalCount === 6;
  const stepIndex = steps.findIndex((item) => item.id === step);
  const progress = (stepIndex + 1) / steps.length;

  useEffect(() => {
    if (isResetMode) return;

    let mounted = true;

    async function redirectIfComplete() {
      const response = await fetch("/api/onboarding");
      if (!mounted || !response.ok) return;
      const { profile } = (await response.json()) as {
        profile?: { onboarding_complete?: boolean };
      };

      if (mounted && profile?.onboarding_complete) {
        router.replace("/dashboard");
      }
    }

    redirectIfComplete();

    return () => {
      mounted = false;
    };
  }, [router, isResetMode]);

  // Synchronize completion redirect
  useEffect(() => {
    if (isBuilding && apiFinished && activeChecklistIndex === CHECKLIST_ITEMS.length - 1) {
      const timer = setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, shouldAnimate ? 800 : 50);
      return () => clearTimeout(timer);
    }
  }, [isBuilding, apiFinished, activeChecklistIndex, router, shouldAnimate]);

  async function handleFinish() {
    if (!isValidSelection || savingRef.current) return;
    savingRef.current = true;
    setIsBuilding(true);
    setSaving(true);
    setError(null);
    setApiError(null);
    setApiFinished(false);
    setActiveChecklistIndex(0);

    const apiPromise = fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examSession, selectedSubjects }),
    });

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex += 1;
      if (currentIndex < CHECKLIST_ITEMS.length) {
        setActiveChecklistIndex(currentIndex);
      } else {
        clearInterval(interval);
      }
    }, shouldAnimate ? 850 : 50);

    try {
      const response = await apiPromise;
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Could not build your workspace.");
      }
      setApiFinished(true);
    } catch (err) {
      clearInterval(interval);
      const message = err instanceof Error ? err.message : "Could not build your workspace.";
      setApiError(message);
      setSaving(false);
      savingRef.current = false;
    }
  }

  // Animation variants for Staggered checklist entrance
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { ease: easeOutQuart, duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen bg-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <AnimatePresence mode="wait">
          {!isBuilding ? (
            <motion.div
              key="onboarding-form"
              initial={shouldAnimate ? { opacity: 0, scale: 0.99 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldAnimate ? { opacity: 0, scale: 0.98 } : undefined}
              transition={{ duration: 0.35, ease: easeOutQuart }}
              className="grid w-full gap-4 lg:grid-cols-[250px_minmax(0,1fr)]"
            >
              <aside className="surface-panel rounded-lg border border-hairline bg-sidebar p-4">
                <div className="mb-5">
                  <p className="text-eyebrow text-primary">IB setup</p>
                  <h2 className="mt-2 text-card-title text-ink">
                    Build your workspace
                  </h2>
                  <p className="mt-2 text-caption text-ink-tertiary">
                    Curriculum structure, IA scaffolding, and syllabus trackers are
                    generated from these choices.
                  </p>
                </div>

                <div className="mb-5 h-1 overflow-hidden rounded-pill bg-surface-3">
                  <motion.div
                    className="h-full origin-left rounded-pill bg-primary"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: progress }}
                    transition={{
                      duration: shouldAnimate ? 0.8 : 0,
                      ease: easeOutQuart,
                    }}
                  />
                </div>

                <div className="space-y-2">
                  {steps.map((item, index) => {
                    const state =
                      index < stepIndex
                        ? "complete"
                        : index === stepIndex
                          ? "active"
                          : "pending";

                    return (
                      <div
                        key={item.id}
                        aria-current={state === "active" ? "step" : undefined}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 transition-colors duration-300",
                          state === "active" &&
                            "border-primary/35 bg-primary/8 text-primary",
                          state === "complete" &&
                            "border-semantic-success/30 bg-semantic-success/10 text-semantic-success",
                          state === "pending" &&
                            "border-hairline bg-surface-1/60 text-ink-tertiary"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-medium transition-colors duration-300",
                              state === "active" && "border-primary/40 bg-primary/10",
                              state === "complete" &&
                                "border-semantic-success/40 bg-semantic-success/10",
                              state === "pending" && "border-hairline bg-surface-2"
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="text-button">{item.label}</span>
                        </div>
                        <p className="mt-1 pl-7 text-caption text-ink-tertiary">
                          {item.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </aside>

              <main className="surface-panel overflow-hidden rounded-lg border border-hairline bg-surface-1">
                <div className="border-b border-hairline bg-surface-2/50 px-5 py-5 sm:px-6">
                  <p className="text-eyebrow text-primary">
                    Step {stepIndex + 1} of {steps.length}
                  </p>
                  <h1 className="mt-2 text-display-md text-ink">
                    {stepCopy[step].title}
                  </h1>
                  <p className="mt-2 max-w-2xl text-body text-ink-subtle">
                    {stepCopy[step].description}
                  </p>
                </div>

                <div className="p-5 sm:p-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={step}
                      initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldAnimate ? { opacity: 0, y: -8 } : undefined}
                      transition={{
                        duration: shouldAnimate ? 0.25 : 0,
                        ease: easeOutQuart,
                      }}
                    >
                      {step === "session" && (
                        <div className="space-y-3">
                          {examSessions.map((session) => {
                            const selected = examSession === session.value;

                            return (
                              <button
                                key={session.value}
                                onClick={() => setExamSession(session.value)}
                                className={cn(
                                  "interactive-control surface-panel flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-body text-ink",
                                  selected
                                    ? "border-primary/45 bg-primary/8"
                                    : "border-hairline bg-surface-1 hover:border-hairline-strong hover:bg-surface-2"
                                )}
                              >
                                <span>{session.label}</span>
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    selected ? "bg-primary" : "bg-ink-tertiary"
                                  )}
                                />
                              </button>
                            );
                          })}
                          <div className="pt-4">
                            <Button
                              onClick={() => setStep("subjects")}
                              disabled={!examSession}
                              className="w-full"
                            >
                              Continue
                            </Button>
                          </div>
                        </div>
                      )}

                      {step === "subjects" && (
                        <div className="space-y-5">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={cn(
                                "rounded-pill border px-2 py-0.5 text-caption",
                                hlCount >= 3
                                  ? "border-primary/35 bg-primary/8 text-primary"
                                  : "border-hairline text-ink-subtle"
                              )}
                            >
                              {hlCount}/3 HL
                            </span>
                            <span
                              className={cn(
                                "rounded-pill border px-2 py-0.5 text-caption",
                                slCount >= 3
                                  ? "border-semantic-info/35 bg-semantic-info/10 text-semantic-info"
                                  : "border-hairline text-ink-subtle"
                              )}
                            >
                              {slCount}/3 SL
                            </span>
                            <span
                              className={cn(
                                "rounded-pill border px-2 py-0.5 text-caption",
                                totalCount === 6
                                  ? "border-semantic-success/35 bg-semantic-success/10 text-semantic-success"
                                  : "border-hairline text-ink-subtle"
                              )}
                            >
                              {totalCount}/6 total
                            </span>
                          </div>

                          <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                            {groups.map((group) => (
                              <div
                                key={group.group}
                                className="surface-panel rounded-lg border border-hairline bg-surface-1 p-3"
                              >
                                <p className="mb-3 text-eyebrow text-ink-subtle">
                                  Group {group.group}: {group.groupName}
                                </p>
                                <div className="space-y-2">
                                  {group.subjects.map((subject) => {
                                    const selected = isSelected(subject.id);
                                    const selectedLevel = selectedSubjects.find(
                                      (s) => s.id === subject.id
                                    )?.level;

                                    return (
                                      <div
                                        key={subject.id}
                                        className={cn(
                                          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2.5",
                                          selected
                                            ? "border-primary/25 bg-primary/5"
                                            : "border-hairline bg-surface-2/40"
                                        )}
                                      >
                                        <span className="truncate text-body-sm text-ink">
                                          {subject.name}
                                        </span>
                                        <div className="flex gap-2">
                                          {subject.availableLevels.includes("HL") && (
                                            <button
                                              onClick={() =>
                                                toggleSubject(
                                                  subject.id,
                                                  subject.name,
                                                  group.group,
                                                  "HL"
                                                )
                                              }
                                              disabled={!selected && totalCount >= 6}
                                              className={cn(
                                                "interactive-control min-h-7 rounded-md border px-2.5 text-caption font-medium disabled:cursor-not-allowed disabled:opacity-30",
                                                selectedLevel === "HL"
                                                  ? "border-primary/40 bg-primary text-on-primary"
                                                  : "border-hairline bg-surface-3 text-ink-subtle hover:text-ink"
                                              )}
                                            >
                                              HL
                                            </button>
                                          )}
                                          {subject.availableLevels.includes("SL") && (
                                            <button
                                              onClick={() =>
                                                toggleSubject(
                                                  subject.id,
                                                  subject.name,
                                                  group.group,
                                                  "SL"
                                                )
                                              }
                                              disabled={!selected && totalCount >= 6}
                                              className={cn(
                                                "interactive-control min-h-7 rounded-md border px-2.5 text-caption font-medium disabled:cursor-not-allowed disabled:opacity-30",
                                                selectedLevel === "SL"
                                                  ? "border-semantic-info/40 bg-semantic-info/15 text-semantic-info"
                                                  : "border-hairline bg-surface-3 text-ink-subtle hover:text-ink"
                                              )}
                                            >
                                              SL
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="grid gap-3 pt-1 sm:grid-cols-2">
                            <Button
                              variant="secondary"
                              onClick={() => setStep("session")}
                            >
                              Back
                            </Button>
                            <Button
                              onClick={() => setStep("review")}
                              disabled={!isValidSelection}
                            >
                              Review
                            </Button>
                          </div>
                        </div>
                      )}

                      {step === "review" && (
                        <div className="space-y-5">
                          <div className="surface-panel rounded-lg border border-hairline bg-surface-1 p-5">
                            <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
                              <div>
                                <p className="mb-1 text-eyebrow text-ink-subtle">
                                  Exam session
                                </p>
                                <p className="text-body text-ink">{examSession}</p>
                              </div>
                              <div>
                                <p className="mb-3 text-eyebrow text-ink-subtle">
                                  Subjects
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {selectedSubjects.map((subject) => (
                                    <div
                                      key={subject.id}
                                      className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface-2/60 px-3 py-2"
                                    >
                                      <span className="truncate text-body-sm text-ink">
                                        {subject.name}
                                      </span>
                                      <span
                                        className={cn(
                                          "rounded-pill px-2 py-0.5 text-caption",
                                          subject.level === "HL"
                                            ? "bg-primary/10 text-primary"
                                            : "bg-semantic-info/10 text-semantic-info"
                                        )}
                                      >
                                        {subject.level}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-body-sm text-ink-subtle">
                            Synapse will generate IA folders, syllabus checklists,
                            and past paper trackers for each subject.
                          </p>

                          {error && (
                            <p className="rounded-md border border-semantic-danger/25 bg-semantic-danger/10 px-3 py-2 text-body-sm text-semantic-danger">
                              {error}
                            </p>
                          )}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <Button
                              variant="secondary"
                              onClick={() => setStep("subjects")}
                              disabled={saving}
                            >
                              Back
                            </Button>
                            <Button onClick={handleFinish} disabled={saving}>
                              Build my workspace
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </main>
            </motion.div>
          ) : (
            <motion.div
              key="onboarding-loading"
              initial={shouldAnimate ? { opacity: 0, scale: 0.98 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldAnimate ? { opacity: 0, scale: 0.95 } : undefined}
              transition={{ duration: 0.4, ease: easeOutQuart }}
              className="w-full max-w-md surface-panel rounded-lg border border-hairline bg-surface-1 p-8 flex flex-col items-center text-center"
            >
              {/* Dual Ring Orbital Spinner */}
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                {/* Outer rotating dashed ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border border-dashed border-primary/30"
                  animate={shouldAnimate ? { rotate: 360 } : {}}
                  transition={shouldAnimate ? { duration: 12, ease: "linear", repeat: Infinity } : undefined}
                />
                
                {/* Inner reverse rotating SVG with gradient ring */}
                <motion.svg
                  className="absolute inset-2 w-20 h-20"
                  viewBox="0 0 100 100"
                  animate={shouldAnimate ? { rotate: -360 } : {}}
                  transition={shouldAnimate ? { duration: 3, ease: "linear", repeat: Infinity } : undefined}
                >
                  <defs>
                    <linearGradient id="spinner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
                      <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke="url(#spinner-grad)"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </motion.svg>

                {/* Central glowing icon container */}
                <motion.div
                  className="absolute z-10 flex items-center justify-center w-12 h-12 rounded-full bg-surface-2 border border-hairline text-primary"
                  animate={shouldAnimate ? {
                    boxShadow: [
                      "0 0 0 0px rgba(94, 106, 210, 0)",
                      "0 0 0 6px rgba(94, 106, 210, 0.12)",
                      "0 0 0 0px rgba(94, 106, 210, 0)"
                    ],
                    scale: [1, 1.04, 1]
                  } : {}}
                  transition={shouldAnimate ? { duration: 2, ease: "easeInOut", repeat: Infinity } : undefined}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              </div>

              {/* Title & Info */}
              <h2 className="text-card-title text-ink font-semibold">
                Assembling Synapse
              </h2>
              <p className="mt-2 text-body-sm text-ink-subtle max-w-[280px]">
                Please wait while we compile your custom academic dashboard...
              </p>

              {/* Staggered Animated Checklist */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="mt-8 space-y-3 w-full text-left max-w-sm"
              >
                {CHECKLIST_ITEMS.map((item, index) => {
                  const isCompleted = index < activeChecklistIndex;
                  const isActive = index === activeChecklistIndex;
                  const isPending = index > activeChecklistIndex;

                  return (
                    <motion.div
                      key={item.id}
                      variants={itemVariants}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 transition-all duration-300",
                        isCompleted && "border-semantic-success/20 bg-semantic-success/5",
                        isActive && "border-primary/20 bg-primary/5",
                        isPending && "border-transparent bg-transparent"
                      )}
                    >
                      {/* Checkbox Status Indicator */}
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {isCompleted && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-semantic-success/10 text-semantic-success">
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <motion.path
                                d="M2.5 6L5 8.5L9.5 3.5"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                              />
                            </svg>
                          </div>
                        )}
                        {isActive && !apiError && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <motion.div
                              className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent"
                              animate={shouldAnimate ? { rotate: 360 } : {}}
                              transition={shouldAnimate ? { duration: 1, ease: "linear", repeat: Infinity } : undefined}
                            />
                          </div>
                        )}
                        {isActive && apiError && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-semantic-danger/10 text-semantic-danger font-semibold text-[10px]">
                            ✕
                          </div>
                        )}
                        {isPending && (
                          <div className="h-4 w-4 rounded-full border border-hairline bg-surface-2/40" />
                        )}
                      </div>

                      {/* Text Label */}
                      <span
                        className={cn(
                          "text-body-sm transition-colors duration-300",
                          isCompleted && "text-ink-muted",
                          isActive && "text-ink font-medium",
                          isPending && "text-ink-tertiary"
                        )}
                      >
                        {item.label}
                        {isActive && !apiError && (
                          <span className="text-[10px] text-ink-subtle ml-2 animate-pulse">
                            ...
                          </span>
                        )}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Error State Callout */}
              {apiError && (
                <div className="mt-6 space-y-4 w-full">
                  <p className="rounded-md border border-semantic-danger/25 bg-semantic-danger/10 px-3 py-2.5 text-body-sm text-semantic-danger text-left">
                    {apiError}
                  </p>
                  <Button
                    onClick={() => {
                      setIsBuilding(false);
                      setSaving(false);
                      savingRef.current = false;
                      setApiError(null);
                    }}
                    className="w-full"
                  >
                    Go back and try again
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}
