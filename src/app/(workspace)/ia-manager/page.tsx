import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AnimatedList, AnimatedItem } from "@/components/layout/animated-list";

const STATUS_COLUMNS = [
  { key: "not_started", label: "Not Started" },
  { key: "research", label: "Research" },
  { key: "drafting", label: "Drafting" },
  { key: "revision", label: "Revision" },
  { key: "submitted", label: "Submitted" },
] as const;

export default async function IAManagerPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [iasResult, subjectsResult] = await Promise.all([
    supabase
      .from("internal_assessments")
      .select("id, title, status, due_date, word_count, target_word_count, subject_id")
      .eq("user_id", user.id),
    supabase
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("user_id", user.id),
  ]);

  const ias = iasResult.data ?? [];
  const subjects = subjectsResult.data ?? [];

  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline text-ink">IA Manager</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          Track all {ias.length} Internal Assessments
        </p>
      </div>

      {ias.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No IAs tracked"
          description="Internal Assessments are auto-generated from your subjects during onboarding."
        />
      ) : (
        <AnimatedList className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STATUS_COLUMNS.map((col) => {
            const colIAs = ias.filter((ia) => ia.status === col.key);
            return (
              <AnimatedItem key={col.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-eyebrow text-ink-subtle">{col.label}</p>
                  <span className="text-caption text-ink-tertiary">{colIAs.length}</span>
                </div>
                <div className="space-y-2">
                  {colIAs.map((ia) => {
                    const subject = subjectMap[ia.subject_id];
                    return (
                      <div
                        key={ia.id}
                        className="bg-surface-1 border border-hairline rounded-lg p-4 space-y-2 hover:border-hairline-strong transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-body-sm text-ink leading-snug">
                            {subject?.subject_name ?? "Unknown"}
                          </p>
                          <span className={`text-caption px-1.5 py-0.5 rounded-sm shrink-0 ${subject?.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-subtle"}`}>
                            {subject?.level}
                          </span>
                        </div>
                        {ia.title && (
                          <p className="text-caption text-ink-subtle truncate">{ia.title}</p>
                        )}
                        {ia.target_word_count && ia.target_word_count > 0 && (
                          <div>
                            <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.min((ia.word_count / ia.target_word_count) * 100, 100)}%` }}
                              />
                            </div>
                            <p className="text-caption text-ink-tertiary mt-1">
                              {ia.word_count}/{ia.target_word_count} words
                            </p>
                          </div>
                        )}
                        {ia.due_date && (
                          <p className="text-caption text-ink-subtle">
                            Due {new Date(ia.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {colIAs.length === 0 && (
                    <div className="h-16 border border-dashed border-hairline rounded-lg flex items-center justify-center">
                      <span className="text-caption text-ink-tertiary">Empty</span>
                    </div>
                  )}
                </div>
              </AnimatedItem>
            );
          })}
        </AnimatedList>
      )}
    </div>
  );
}
