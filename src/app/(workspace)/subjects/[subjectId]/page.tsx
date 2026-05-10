import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { BookOpen, FileText, CheckSquare, Archive } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";

interface SubjectPageProps {
  params: Promise<{ subjectId: string }>;
}

export default async function SubjectDetailPage({ params }: SubjectPageProps) {
  const { subjectId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("user_subjects")
    .select("id, subject_name, level, subject_group, language")
    .eq("id", subjectId)
    .eq("user_id", user.id)
    .single();

  if (!subject) notFound();

  const [notesResult, syllabusResult, iaResult] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, updated_at, folder_path")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("syllabus_progress")
      .select("id, topic_id, completed")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId),
    supabase
      .from("internal_assessments")
      .select("id, title, status, word_count, target_word_count, due_date")
      .eq("user_id", user.id)
      .eq("subject_id", subjectId)
      .single(),
  ]);

  const notes = notesResult.data ?? [];
  const syllabusProgress = syllabusResult.data ?? [];
  const ia = iaResult.data;

  const completedTopics = syllabusProgress.filter((s) => s.completed).length;
  const totalTopics = syllabusProgress.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/subjects" className="text-body-sm text-ink-subtle hover:text-ink transition-colors">
              Subjects
            </a>
            <span className="text-ink-tertiary">/</span>
            <span className="text-body-sm text-ink">{subject.subject_name}</span>
          </div>
          <h1 className="text-headline text-ink">{subject.subject_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-caption px-2 py-0.5 rounded-pill ${subject.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-subtle"}`}>
              {subject.level}
            </span>
            <span className="text-caption text-ink-subtle">Group {subject.subject_group}</span>
            <span className="text-caption text-ink-subtle">·</span>
            <span className="text-caption text-ink-subtle">{subject.language}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notes" className="space-y-4">
        <TabsList className="bg-surface-2 border border-hairline">
          <TabsTrigger value="notes" className="data-[state=active]:bg-surface-3 data-[state=active]:text-ink text-ink-subtle">
            Notes {notes.length > 0 && `(${notes.length})`}
          </TabsTrigger>
          <TabsTrigger value="syllabus" className="data-[state=active]:bg-surface-3 data-[state=active]:text-ink text-ink-subtle">
            Syllabus {totalTopics > 0 && `(${completedTopics}/${totalTopics})`}
          </TabsTrigger>
          <TabsTrigger value="ia" className="data-[state=active]:bg-surface-3 data-[state=active]:text-ink text-ink-subtle">
            IA
          </TabsTrigger>
        </TabsList>

        {/* Notes tab */}
        <TabsContent value="notes" className="space-y-3">
          {notes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No notes yet"
              description="Start taking notes for this subject."
            />
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex items-center justify-between px-4 py-3 bg-surface-1 border border-hairline rounded-md hover:border-hairline-strong transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-ink-tertiary shrink-0" />
                    <span className="text-body-sm text-ink">{note.title}</span>
                  </div>
                  <span className="text-caption text-ink-subtle">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Syllabus tab */}
        <TabsContent value="syllabus">
          {totalTopics === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Syllabus not loaded"
              description="Syllabus checklist will appear here once topics are loaded."
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-body-sm text-ink-subtle">
                  {completedTopics} of {totalTopics} topics completed
                </p>
                <div className="w-32 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0}%` }}
                  />
                </div>
              </div>
              {syllabusProgress.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5 bg-surface-1 border border-hairline rounded-md"
                >
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${item.completed ? "bg-primary border-primary" : "border-hairline-strong"}`}>
                    {item.completed && (
                      <svg className="w-2.5 h-2.5 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-body-sm ${item.completed ? "text-ink-subtle line-through" : "text-ink"}`}>
                    {item.topic_id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* IA tab */}
        <TabsContent value="ia">
          {!ia ? (
            <EmptyState
              icon={Archive}
              title="No IA tracked"
              description="Your Internal Assessment for this subject will appear here."
            />
          ) : (
            <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-card-title text-ink">{ia.title ?? "Untitled IA"}</h3>
                  {ia.due_date && (
                    <p className="text-body-sm text-ink-subtle mt-1">
                      Due {new Date(ia.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <IAStatusBadge status={ia.status} />
              </div>
              {ia.target_word_count && (
                <div>
                  <div className="flex justify-between text-caption text-ink-subtle mb-1.5">
                    <span>Word count</span>
                    <span>{ia.word_count} / {ia.target_word_count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min((ia.word_count / ia.target_word_count) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <a href="/ia-manager" className="text-body-sm text-primary hover:text-primary-hover transition-colors">
                View in IA Manager →
              </a>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IAStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    not_started: { label: "Not started", className: "bg-surface-3 text-ink-subtle" },
    research: { label: "Research", className: "bg-primary/10 text-primary" },
    drafting: { label: "Drafting", className: "bg-primary/20 text-primary" },
    revision: { label: "Revision", className: "bg-semantic-success/10 text-semantic-success" },
    submitted: { label: "Submitted", className: "bg-semantic-success/20 text-semantic-success" },
  };
  const s = map[status] ?? map["not_started"]!;
  return (
    <span className={`text-caption px-2 py-0.5 rounded-pill ${s.className}`}>
      {s.label}
    </span>
  );
}
