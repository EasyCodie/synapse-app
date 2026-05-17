import { createClient } from "@/lib/local/client";
import { getWorkspaceProfile, requireUser } from "@/lib/auth";
import { format, differenceInDays } from "date-fns";
import Link from "next/link";
import {
  CheckSquare,
  BookOpen,
  ClipboardList,
  GraduationCap,
  Plus,
  Upload,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type DashboardSubject = { id: string; subject_name: string; level: string };
type DashboardTask = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  completed: boolean;
  subject_id: string | null;
};
type DashboardIA = {
  id: string;
  title: string | null;
  status: string;
  due_date: string | null;
  subject_id: string | null;
};

export default async function DashboardPage() {
  const user = await requireUser();
  const local = await createClient();

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
    local
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("user_id", user.id)
      .order("subject_group"),
    local
      .from("tasks")
      .select("id, title, due_date, priority, completed, subject_id", {
        count: "exact",
      })
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("due_date", { ascending: true })
      .limit(5),
    local
      .from("internal_assessments")
      .select("id, title, status, due_date, subject_id")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
    local
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    local
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .lte("next_review", now.toISOString()),
  ]);

  const subjects = (subjectsResult.data ?? []) as DashboardSubject[];
  const tasks = (tasksResult.data ?? []) as DashboardTask[];
  const ias = (iasResult.data ?? []) as DashboardIA[];
  const openTaskCount = tasksResult.count ?? tasks.length;
  const flashcardCount = flashcardsCountResult.count ?? 0;
  const dueFlashcards = dueFlashcardsResult.count ?? 0;

  // Build subject lookup map (O(1) per lookup)
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const greeting = getGreeting();
  const today = format(now, "EEEE, MMMM d");
  const examCountdown = getExamCountdown(profile?.exam_session);

  return (
    <div className="space-y-4">
      {/* Header row — greeting + actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-compact text-ink">
            {greeting}, {profile?.full_name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-cell text-ink-tertiary mt-0.5">
            {today}
            {profile?.exam_session ? <> · {profile.exam_session}</> : null}
            {examCountdown !== null ? (
              <> · <span className="text-ink-subtle">{examCountdown}d to exams</span></>
            ) : null}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-hairline bg-canvas text-cell text-ink-subtle hover:text-ink hover:border-hairline-strong transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-hairline bg-canvas text-cell text-ink-subtle hover:text-ink hover:border-hairline-strong transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ask Synapse
          </Link>
          <Link
            href="/resources"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-hairline bg-canvas text-cell text-ink-subtle hover:text-ink hover:border-hairline-strong transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </Link>
          {dueFlashcards > 0 ? (
            <Link
              href="/flashcards"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/5 text-cell font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Review {dueFlashcards}
            </Link>
          ) : null}
        </div>
      </div>

      {/* Stats row — individual bordered cells */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCell
          label="Subjects"
          value={subjects.length}
          sublabel={`${subjects.filter((s) => s.level === "HL").length} HL · ${subjects.filter((s) => s.level === "SL").length} SL`}
          href="/subjects"
        />
        <StatCell
          label="Open Tasks"
          value={openTaskCount}
          sublabel={openTaskCount > 0 ? "need attention" : "all clear"}
          href="/calendar"
          isAlert={openTaskCount > 3}
        />
        <StatCell
          label="IAs"
          value={ias.length}
          sublabel={`${ias.filter((ia) => ia.status === "submitted").length} submitted`}
          href="/ia-manager"
        />
        <StatCell
          label="Flashcards"
          value={flashcardCount}
          sublabel={dueFlashcards > 0 ? `${dueFlashcards} due` : "all reviewed"}
          href="/flashcards"
          isAlert={dueFlashcards > 0}
        />
      </div>

      {/* Flashcard review notice */}
      {dueFlashcards > 0 ? (
        <Link
          href="/flashcards"
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-md border border-primary/20 bg-primary/5 hover:bg-primary/8 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="text-cell text-ink-subtle flex-1">
            {dueFlashcards} card{dueFlashcards !== 1 ? "s" : ""} ready for
            review
          </span>
          <span className="text-cell text-primary font-medium">
            Review now →
          </span>
        </Link>
      ) : null}

      {/* Main content — two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Tasks panel */}
        <div className="rounded-lg border border-hairline bg-canvas">
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
            <h2 className="text-cell font-medium text-ink">Tasks</h2>
            <Link
              href="/calendar"
              className="text-[11px] text-ink-tertiary hover:text-ink transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="px-4 py-2">
            {tasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="No upcoming tasks"
                description="Create your first task to start tracking deadlines."
                action={{ label: "Add Task", href: "/calendar" }}
                className="py-6"
              />
            ) : (
              <div className="divide-y divide-hairline/40">
                {tasks.map((task) => {
                  const subject = subjectById.get(task.subject_id ?? "");
                  const isOverdue = task.due_date
                    ? differenceInDays(new Date(task.due_date), now) < 0
                    : false;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 py-2 group"
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${priorityColor(task.priority)}`}
                      />
                      <span className="text-cell text-ink flex-1 truncate">
                        {task.title}
                      </span>
                      {subject ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-tertiary shrink-0">
                          {subject.subject_name}
                        </span>
                      ) : null}
                      {task.due_date ? (
                        <span
                          className={`text-[11px] shrink-0 tabular-nums ${isOverdue ? "text-destructive" : "text-ink-tertiary"}`}
                        >
                          {getRelativeDate(task.due_date)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* IAs panel */}
        <div className="rounded-lg border border-hairline bg-canvas">
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
            <h2 className="text-cell font-medium text-ink">
              Internal Assessments
            </h2>
            <Link
              href="/ia-manager"
              className="text-[11px] text-ink-tertiary hover:text-ink transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="px-4 py-2">
            {ias.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No IAs tracked"
                description="Internal Assessments are auto-generated during onboarding."
                className="py-6"
              />
            ) : (
              <div className="divide-y divide-hairline/40">
                {ias.slice(0, 5).map((ia) => {
                  const subject = subjectById.get(ia.subject_id ?? "");
                  return (
                    <div
                      key={ia.id}
                      className="flex items-center gap-2.5 py-2 group"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor(ia.status)}`}
                      />
                      <span className="text-cell text-ink flex-1 truncate">
                        {ia.title ?? "Untitled IA"}
                      </span>
                      {subject ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-2 text-ink-tertiary shrink-0">
                          {subject.subject_name}
                        </span>
                      ) : null}
                      <StatusBadge status={ia.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subjects panel — full width */}
      <div className="rounded-lg border border-hairline bg-canvas">
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <h2 className="text-cell font-medium text-ink">Subjects</h2>
          <Link
            href="/subjects"
            className="text-[11px] text-ink-tertiary hover:text-ink transition-colors"
          >
            View all →
          </Link>
        </div>
        <div className="px-4 py-3">
          {subjects.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No subjects yet"
              description="Complete onboarding to set up your IB subjects."
              action={{ label: "Go to onboarding", href: "/onboarding" }}
              className="py-6"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/subjects/${subject.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-hairline bg-surface-1 text-cell text-ink-subtle hover:text-ink hover:border-hairline-strong transition-colors"
                >
                  {subject.subject_name}
                  <span
                    className={`text-[10px] font-medium px-1 py-0 rounded ${subject.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-tertiary"}`}
                  >
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

function StatCell({
  label,
  value,
  sublabel,
  href,
  isAlert,
}: {
  label: string;
  value: number;
  sublabel?: string;
  href: string;
  isAlert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-hairline bg-canvas px-4 py-3 hover:border-hairline-strong transition-colors"
    >
      <p className="text-[11px] text-ink-tertiary mb-1">{label}</p>
      <p
        className={`text-body-sm font-semibold ${isAlert ? "text-primary" : "text-ink"}`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="text-[11px] text-ink-tertiary mt-0.5">{sublabel}</p>
      ) : null}
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    not_started: {
      label: "Not started",
      className: "bg-surface-3 text-ink-subtle",
    },
    research: { label: "Research", className: "bg-primary/10 text-primary" },
    drafting: { label: "Drafting", className: "bg-primary/20 text-primary" },
    revision: {
      label: "Revision",
      className: "bg-semantic-success/10 text-semantic-success",
    },
    submitted: {
      label: "Submitted",
      className: "bg-semantic-success/20 text-semantic-success",
    },
  };
  const s = map[status] ?? map["not_started"]!;
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${s.className}`}>
      {s.label}
    </span>
  );
}

function statusDotColor(status: string): string {
  const map: Record<string, string> = {
    not_started: "bg-ink-tertiary",
    research: "bg-primary/60",
    drafting: "bg-primary",
    revision: "bg-semantic-success/60",
    submitted: "bg-semantic-success",
  };
  return map[status] ?? "bg-ink-tertiary";
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

function getExamCountdown(
  examSession: string | null | undefined
): number | null {
  if (!examSession) return null;
  const match = examSession.match(/^([MN])(\d{2})$/);
  if (!match) return null;
  const [, session, yearStr] = match;
  const year = 2000 + parseInt(yearStr);
  const examMonth = session === "M" ? 4 : 10;
  const examDate = new Date(year, examMonth, 1);
  const days = differenceInDays(examDate, new Date());
  return days > 0 ? days : null;
}
