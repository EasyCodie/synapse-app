import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { percent } from "@/lib/curriculum-shared";
import type { ElementType } from "react";
import Link from "next/link";
import { BookOpen, CheckSquare, ClipboardList, FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AnimatedList, AnimatedItem } from "@/components/layout/animated-list";

type SubjectItem = {
  id: string;
  subject_name: string;
  level: string;
  subject_group: number;
};

export default async function SubjectsPage() {
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const [subjectsResult, syllabusResult, iaResult, notesResult] = await Promise.all([
    local
      .from("user_subjects")
      .select("id, subject_name, level, subject_group")
      .eq("user_id", user.id)
      .order("subject_group"),
    local
      .from("syllabus_progress")
      .select("id, subject_id, completed")
      .eq("user_id", user.id),
    local
      .from("internal_assessments")
      .select("id, subject_id, status")
      .eq("user_id", user.id),
    local
      .from("notes")
      .select("id, subject_id")
      .eq("user_id", user.id),
  ]);

  const subjectList = (subjectsResult.data ?? []) as SubjectItem[];
  const syllabus = (syllabusResult.data ?? []) as Array<{
    subject_id: string;
    completed: boolean;
  }>;
  const ias = (iaResult.data ?? []) as Array<{ subject_id: string; status: string }>;
  const notes = (notesResult.data ?? []) as Array<{ subject_id: string }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline text-ink">Subjects</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          Your {subjectList.length} IB Diploma subjects
        </p>
      </div>

      {subjectList.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Complete onboarding to set up your subjects."
          action={{ label: "Go to onboarding", href: "/onboarding" }}
        />
      ) : (
        <AnimatedList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjectList.map((subject) => (
            <AnimatedItem key={subject.id}>
              <Link
                href={`/subjects/${subject.id}`}
                className="block bg-surface-1 border border-hairline rounded-lg p-6 hover:border-hairline-strong hover:bg-surface-2 transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-md bg-surface-3 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-ink-subtle" />
                  </div>
                  <span
                    className={`text-caption px-2 py-0.5 rounded-pill ${
                      subject.level === "HL"
                        ? "bg-primary/10 text-primary"
                        : "bg-surface-3 text-ink-subtle"
                    }`}
                  >
                    {subject.level}
                  </span>
                </div>
                <h3 className="text-body text-ink font-medium group-hover:text-ink">
                  {subject.subject_name}
                </h3>
                <p className="text-caption text-ink-subtle mt-1">
                  Group {subject.subject_group}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <SubjectMetric
                    icon={CheckSquare}
                    label="Syllabus"
                    value={`${subjectSyllabusPercent(subject.id, syllabus)}%`}
                  />
                  <SubjectMetric
                    icon={ClipboardList}
                    label="IA"
                    value={ias.find((ia) => ia.subject_id === subject.id)?.status?.replace("_", " ") ?? "none"}
                  />
                  <SubjectMetric
                    icon={FileText}
                    label="Notes"
                    value={String(notes.filter((note) => note.subject_id === subject.id).length)}
                  />
                </div>
              </Link>
            </AnimatedItem>
          ))}
        </AnimatedList>
      )}
    </div>
  );
}

function subjectSyllabusPercent(
  subjectId: string,
  syllabus: Array<{ subject_id: string; completed: boolean }>
) {
  const items = syllabus.filter((item) => item.subject_id === subjectId);
  return percent(items.filter((item) => item.completed).length, items.length);
}

function SubjectMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface-2 px-2 py-2">
      <div className="flex items-center gap-1.5 text-ink-tertiary">
        <Icon className="h-3 w-3" />
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="mt-1 truncate text-caption text-ink-subtle">{value}</p>
    </div>
  );
}
