"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateAllWorkspaces, type SubjectSelection } from "@/lib/workspace-generator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import examSessions from "@/data/exam-sessions.json";
import ibSubjects from "@/data/ib-subjects.json";

type Step = "session" | "subjects" | "review";

interface SubjectGroup {
  group: number;
  groupName: string;
  subjects: Array<{
    id: string;
    name: string;
    availableLevels: string[];
  }>;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("session");
  const [examSession, setExamSession] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

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
        // If same level, remove it; if different level, update it
        if (existing.level === level) {
          return prev.filter((s) => s.id !== subjectId);
        }
        return prev.map((s) =>
          s.id === subjectId ? { ...s, level } : s
        );
      }
      // Add new subject
      return [
        ...prev,
        { id: subjectId, name: subjectName, group, level, language: "English" },
      ];
    });
  }

  function isSelected(subjectId: string, level?: "HL" | "SL") {
    const s = selectedSubjects.find((s) => s.id === subjectId);
    if (!s) return false;
    if (level) return s.level === level;
    return true;
  }

  const hlCount = selectedSubjects.filter((s) => s.level === "HL").length;
  const slCount = selectedSubjects.filter((s) => s.level === "SL").length;
  const totalCount = selectedSubjects.length;
  const isValidSelection = hlCount >= 3 && slCount >= 3 && totalCount === 6;

  useEffect(() => {
    let mounted = true;

    async function redirectIfComplete() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted && profile?.onboarding_complete) {
        router.replace("/dashboard");
      }
    }

    redirectIfComplete();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleFinish() {
    if (!isValidSelection || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      savingRef.current = false;
      setSaving(false);
      router.push("/login");
      return;
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfileError) {
      setError(existingProfileError.message);
      savingRef.current = false;
      setSaving(false);
      return;
    }

    if (existingProfile?.onboarding_complete) {
      router.replace("/dashboard");
      return;
    }

    // Insert subjects
    const subjectRows = selectedSubjects.map((s) => ({
      user_id: user.id,
      subject_name: s.name,
      subject_group: s.group,
      level: s.level,
      language: s.language,
    }));

    const { data: insertedSubjects, error: subjectsError } = await supabase
      .from("user_subjects")
      .upsert(subjectRows, { onConflict: "user_id,subject_name" })
      .select("id, subject_name");

    if (subjectsError) {
      setError(subjectsError.message);
      savingRef.current = false;
      setSaving(false);
      return;
    }

    const subjectIdByName = new Map(
      (insertedSubjects ?? []).map((subject) => [subject.subject_name, subject.id])
    );

    // Generate and store workspace structures
    const workspaces = generateAllWorkspaces(selectedSubjects);
    const workspaceRows = workspaces.map((ws) => ({
      user_id: user.id,
      subject_id: subjectIdByName.get(ws.subjectName) ?? null,
      structure: ws as unknown as Record<string, unknown>,
    }));

    if (workspaceRows.some((row) => !row.subject_id)) {
      setError("Could not match every selected subject to a workspace.");
      savingRef.current = false;
      setSaving(false);
      return;
    }

    const { error: workspaceError } = await supabase
      .from("workspaces")
      .upsert(workspaceRows, { onConflict: "user_id,subject_id" });

    if (workspaceError) {
      setError(workspaceError.message);
      savingRef.current = false;
      setSaving(false);
      return;
    }

    // Mark onboarding complete only after subjects and workspaces are ready.
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        exam_session: examSession,
        onboarding_complete: true,
        full_name: user.user_metadata?.["full_name"] ?? null,
      });

    if (profileError) {
      setError(profileError.message);
      savingRef.current = false;
      setSaving(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-eyebrow text-primary mb-2">
            {step === "session" ? "Step 1 of 3" : step === "subjects" ? "Step 2 of 3" : "Step 3 of 3"}
          </p>
          <h1 className="text-display-md text-ink">
            {step === "session" && "When are your exams?"}
            {step === "subjects" && "Choose your 6 subjects"}
            {step === "review" && "Your workspace is ready"}
          </h1>
          <p className="text-body text-ink-subtle mt-2">
            {step === "session" && "Synapse will build your 2-year academic timeline around your exam session."}
            {step === "subjects" && "Select 3 HL and 3 SL subjects. Synapse will generate your IA folders, syllabus checklists, and past paper trackers."}
            {step === "review" && "Review your selections before we generate your workspace."}
          </p>
        </div>

        {/* Step: Exam Session */}
        {step === "session" && (
          <div className="space-y-3">
            {examSessions.map((session) => (
              <button
                key={session.value}
                onClick={() => setExamSession(session.value)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg border transition-colors",
                  "text-body text-ink",
                  examSession === session.value
                    ? "bg-surface-2 border-primary text-ink"
                    : "bg-surface-1 border-hairline hover:border-hairline-strong hover:bg-surface-2"
                )}
              >
                {session.label}
              </button>
            ))}
            <div className="pt-4">
              <Button
                onClick={() => setStep("subjects")}
                disabled={!examSession}
                className="bg-primary hover:bg-primary-hover text-on-primary w-full"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Subject Selection */}
        {step === "subjects" && (
          <div className="space-y-6">
            {/* Selection counter */}
            <div className="flex gap-4 text-body-sm">
              <span className={cn("px-2 py-0.5 rounded-pill border text-caption", hlCount >= 3 ? "border-semantic-success text-semantic-success" : "border-hairline text-ink-subtle")}>
                {hlCount}/3 HL
              </span>
              <span className={cn("px-2 py-0.5 rounded-pill border text-caption", slCount >= 3 ? "border-semantic-success text-semantic-success" : "border-hairline text-ink-subtle")}>
                {slCount}/3 SL
              </span>
              <span className={cn("px-2 py-0.5 rounded-pill border text-caption", totalCount === 6 ? "border-semantic-success text-semantic-success" : "border-hairline text-ink-subtle")}>
                {totalCount}/6 total
              </span>
            </div>

            {groups.map((group) => (
              <div key={group.group}>
                <p className="text-eyebrow text-ink-subtle mb-3">
                  Group {group.group} — {group.groupName}
                </p>
                <div className="space-y-2">
                  {group.subjects.map((subject) => {
                    const selected = isSelected(subject.id);
                    const selectedLevel = selectedSubjects.find((s) => s.id === subject.id)?.level;

                    return (
                      <div
                        key={subject.id}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 rounded-lg border transition-colors",
                          selected
                            ? "bg-surface-2 border-hairline-strong"
                            : "bg-surface-1 border-hairline"
                        )}
                      >
                        <span className="text-body-sm text-ink">{subject.name}</span>
                        <div className="flex gap-2">
                          {subject.availableLevels.includes("HL") && (
                            <button
                              onClick={() => toggleSubject(subject.id, subject.name, group.group, "HL")}
                              disabled={!selected && totalCount >= 6}
                              className={cn(
                                "px-2.5 py-1 rounded-sm text-caption font-medium transition-colors",
                                selectedLevel === "HL"
                                  ? "bg-primary text-on-primary"
                                  : "bg-surface-3 text-ink-subtle hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                              )}
                            >
                              HL
                            </button>
                          )}
                          {subject.availableLevels.includes("SL") && (
                            <button
                              onClick={() => toggleSubject(subject.id, subject.name, group.group, "SL")}
                              disabled={!selected && totalCount >= 6}
                              className={cn(
                                "px-2.5 py-1 rounded-sm text-caption font-medium transition-colors",
                                selectedLevel === "SL"
                                  ? "bg-primary text-on-primary"
                                  : "bg-surface-3 text-ink-subtle hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
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

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setStep("session")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep("review")}
                disabled={!isValidSelection}
                className="flex-1 bg-primary hover:bg-primary-hover text-on-primary"
              >
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="space-y-6">
            <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
              <div>
                <p className="text-eyebrow text-ink-subtle mb-1">Exam Session</p>
                <p className="text-body text-ink">{examSession}</p>
              </div>
              <div className="h-px bg-hairline" />
              <div>
                <p className="text-eyebrow text-ink-subtle mb-3">Subjects</p>
                <div className="space-y-2">
                  {selectedSubjects.map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <span className="text-body-sm text-ink">{s.name}</span>
                      <span className={cn(
                        "text-caption px-2 py-0.5 rounded-pill",
                        s.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-subtle"
                      )}>
                        {s.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-body-sm text-ink-subtle">
              Synapse will generate IA folders, syllabus checklists, and past paper trackers for each subject.
            </p>

            {error && (
              <p className="text-body-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setStep("subjects")}
                className="flex-1"
                disabled={saving}
              >
                Back
              </Button>
              <Button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 bg-primary hover:bg-primary-hover text-on-primary"
              >
                {saving ? "Building workspace…" : "Build my workspace"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
