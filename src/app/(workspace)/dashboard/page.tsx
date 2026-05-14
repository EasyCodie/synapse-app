import { createClient } from "@/lib/supabase/server";
import { getWorkspaceProfile, requireUser } from "@/lib/auth";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import {
  CheckSquare,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Plus,
  ArrowRight,
  Upload,
  Sparkles,
  Clock,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const now = new Date();

  const [
    profile,
    subjectsResult,
    tasksResult,
    iasResult,
    flashcardsCountResult,
    dueFlashcardsResult,
  ] = await Promise.all([
    getWorkspaceProfile(user.id),
    supabase
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("user_id", user.id)
      .order("subject_group"),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, completed, subject_id", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true })
      .limit(5),
    supabase
      .from("internal_assessments")
      .select("id, title, status, due_date, subject_id")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review", now.toISOString()),
  ]);

  const subjects = subjectsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const ias = iasResult.data ?? [];
  const openTaskCount = tasksResult.count ?? tasks.length;
  const flashcardCount = flashcardsCountResult.count ?? 0;
  const dueFlashcards = dueFlashcardsResult.count ?? 0;

  const greeting = getGreeting();
  const today = format(now, "EEEE, MMMM d");

  // Calculate exam countdown
  const examCountdown = getExamCountdown(profile?.exam_session);

  return (
    <div className="space-y-8">
      {/* Header with greeting + exam countdown */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-eyebrow text-ink-subtle mb-1">{today}</p>
          <h1 className="text-headline text-ink">
            {greeting}, {profile?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-body-sm text-ink-subtle mt-1">
            {profile?.exam_session && <>{profile.exam_session} · </>}
            {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
            {openTaskCount > 0 && (
              <> · <span className="text-ink-muted">{openTaskCount} task{openTaskCount !== 1 ? "s" : ""} due</span></>
            )}
          </p>
        </div>
        {examCountdown !== null && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-surface-1 border border-hairline rounded-lg">
            <Clock className="w-4 h-4 text-primary" />
            <div>
              <p className="text-caption text-ink-muted">Exams in</p>
              <p className="text-body-sm font-medium text-ink">{examCountdown} days</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-2 px-3 py-2 bg-surface-1 border border-hairline rounded-md text-body-sm text-ink-subtle hover:text-ink hover:border-hairline-strong transition-all duration-200"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-3 py-2 bg-surface-1 border border-hairline rounded-md text-body-sm text-ink-subtle hover:text-ink hover:border-hairline-strong transition-all duration-200"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Ask Synapse
        </Link>
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 px-3 py-2 bg-surface-1 border border-hairline rounded-md text-body-sm text-ink-subtle hover:text-ink hover:border-hairline-strong transition-all duration-200"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </Link>
        {dueFlashcards > 0 && (
          <Link
            href="/flashcards"
            className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md text-body-sm text-primary hover:bg-primary/15 transition-all duration-200"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Review {dueFlashcards} card{dueFlashcards !== 1 ? "s" : ""}
          </Link>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Subjects"
          value={subjects.length}
          icon={BookOpen}
          sublabel={`${subjects.filter((s) => s.level === "HL").length} HL · ${subjects.filter((s) => s.level === "SL").length} SL`}
          href="/subjects"
        />
        <StatCard
          label="Open Tasks"
          value={openTaskCount}
          icon={CheckSquare}
          sublabel={openTaskCount > 0 ? "need attention" : "all clear"}
          href="/calendar"
          accent={openTaskCount > 3}
        />
        <StatCard
          label="IAs"
          value={ias.length}
          icon={ClipboardList}
          sublabel={`${ias.filter((ia) => ia.status === "submitted").length} submitted`}
          href="/ia-manager"
        />
        <StatCard
          label="Flashcards"
          value={flashcardCount}
          icon={GraduationCap}
          sublabel={dueFlashcards > 0 ? `${dueFlashcards} due for review` : "all reviewed"}
          href="/flashcards"
          accent={dueFlashcards > 0}
        />
      </div>

      {/* Flashcard review CTA (prominent when cards are due) */}
      {dueFlashcards > 0 && (
        <Link
          href="/flashcards"
          className="flex items-center justify-between px-6 py-5 bg-primary/5 border border-primary/15 rounded-lg hover:bg-primary/8 hover:border-primary/25 transition-all duration-200 group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-body-sm font-medium text-ink">
                {dueFlashcards} flashcard{dueFlashcards !== 1 ? "s" : ""} ready for review
              </p>
              <p className="text-caption text-ink-subtle">
                Keep your streak going — spaced repetition works best with daily reviews
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
        </Link>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming tasks */}
        <div className="bg-surface-1 border border-hairline rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-card-title text-ink">Upcoming Tasks</h2>
            <Link href="/calendar" className="text-caption text-primary hover:text-primary-hover transition-colors duration-200">
              View all
            </Link>
          </div>
          {tasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="No upcoming tasks"
              description="Create your first task to start tracking your IB deadlines."
              action={{ label: "Add Task", href: "/calendar" }}
              className="py-8"
            />
          ) : (
            <div className="space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-md hover:bg-surface-2/50 transition-colors duration-200"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColor(task.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-ink truncate">{task.title}</p>
                  </div>
                  {task.due_date && (
                    <span className="text-caption text-ink-tertiary shrink-0">
                      {getRelativeDate(task.due_date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IA Progress */}
        <div className="bg-surface-1 border border-hairline rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-card-title text-ink">IA Progress</h2>
            <Link href="/ia-manager" className="text-caption text-primary hover:text-primary-hover transition-colors duration-200">
              View all
            </Link>
          </div>
          {ias.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No IAs tracked"
              description="Internal Assessments are auto-generated from your subjects during onboarding."
              className="py-8"
            />
          ) : (
            <div className="space-y-1">
              {ias.slice(0, 5).map((ia) => {
                const subject = subjects.find((s) => s.id === ia.subject_id);
                return (
                  <div
                    key={ia.id}
                    className="flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-md hover:bg-surface-2/50 transition-colors duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-ink truncate">
                        {subject?.subject_name ?? "Unknown subject"}
                      </p>
                      <p className="text-caption text-ink-tertiary">
                        {ia.title ?? "Untitled IA"}
                      </p>
                    </div>
                    <StatusBadge status={ia.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Subjects overview */}
        <div className="bg-surface-1 border border-hairline rounded-lg p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-card-title text-ink">Your Subjects</h2>
            <Link href="/subjects" className="text-caption text-primary hover:text-primary-hover transition-colors duration-200">
              View all
            </Link>
          </div>
          {subjects.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No subjects yet"
              description="Complete onboarding to set up your IB subjects."
              action={{ label: "Go to onboarding", href: "/onboarding" }}
              className="py-8"
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/subjects/${subject.id}`}
                  className="flex items-center justify-between px-4 py-3 bg-surface-2 border border-hairline rounded-md hover:border-hairline-strong transition-all duration-200 group"
                >
                  <span className="text-body-sm text-ink truncate">
                    {subject.subject_name}
                  </span>
                  <span className={`text-caption px-1.5 py-0.5 rounded-sm ml-2 shrink-0 ${subject.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-subtle"}`}>
                    {subject.level}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  sublabel,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sublabel?: string;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div className={`bg-surface-1 border rounded-lg p-6 transition-all duration-200 ${href ? "hover:border-hairline-strong hover:bg-surface-2/30 cursor-pointer" : ""} ${accent ? "border-primary/20" : "border-hairline"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accent ? "bg-primary/10" : "bg-surface-2"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-ink-subtle"}`} />
        </div>
        {href && (
          <ArrowRight className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        )}
      </div>
      <p className="text-headline text-ink">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-caption text-ink-subtle">{label}</span>
        {sublabel && <span className="text-caption text-ink-tertiary">{sublabel}</span>}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group">
        {content}
      </Link>
    );
  }
  return content;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    not_started: { label: "Not started", className: "bg-surface-3 text-ink-subtle" },
    research: { label: "Research", className: "bg-primary/10 text-primary" },
    drafting: { label: "Drafting", className: "bg-primary/20 text-primary" },
    revision: { label: "Revision", className: "bg-semantic-success/10 text-semantic-success" },
    submitted: { label: "Submitted", className: "bg-semantic-success/20 text-semantic-success" },
  };
  const s = map[status] ?? map["not_started"]!;
  return (
    <span className={`text-caption px-2 py-0.5 rounded-pill shrink-0 ${s.className}`}>
      {s.label}
    </span>
  );
}

function priorityColor(priority: string) {
  const map: Record<string, string> = {
    low: "bg-ink-tertiary",
    medium: "bg-ink-subtle",
    high: "bg-primary",
    urgent: "bg-red-500",
  };
  return map[priority] ?? "bg-ink-tertiary";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const days = differenceInDays(date, now);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return format(date, "MMM d");
}

function getExamCountdown(examSession: string | null | undefined): number | null {
  if (!examSession) return null;
  // Parse exam session like "M25" or "N25"
  const match = examSession.match(/^([MN])(\d{2})$/);
  if (!match) return null;
  const [, session, yearStr] = match;
  const year = 2000 + parseInt(yearStr);
  // May exams start ~May 1, November exams start ~Nov 1
  const examMonth = session === "M" ? 4 : 10; // 0-indexed months
  const examDate = new Date(year, examMonth, 1);
  const days = differenceInDays(examDate, new Date());
  return days > 0 ? days : null;
}
