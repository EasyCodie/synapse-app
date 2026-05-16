import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { BookOpen } from "lucide-react";
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
  const local = await createClient();

  const { data: subjects } = await local
    .from("user_subjects")
    .select("id, subject_name, level, subject_group")
    .eq("user_id", user.id)
    .order("subject_group");

  const subjectList = (subjects ?? []) as SubjectItem[];

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
              </Link>
            </AnimatedItem>
          ))}
        </AnimatedList>
      )}
    </div>
  );
}
