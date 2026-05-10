import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { format } from "date-fns";
import {
  CheckSquare,
  BookOpen,
  ClipboardList,
  Calendar,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [profileResult, subjectsResult, tasksResult, iasResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, exam_session")
        .eq("id", user.id)
        .single(),
      supabase
        .from("user_subjects")
        .select("id, subject_name, level")
        .eq("user_id", user.id)
        .order("subject_group"),
      supabase
        .from("tasks")
        .select("id, title, due_date, priority, completed, subject_id")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("due_date", { ascending: true })
        .limit(5),
      supabase
        .from("internal_assessments")
        .select("id, title, status, due_date, subject_id")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true }),
    ]);

  const profile = profileResult.data;
  const subjects = subjectsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const ias = iasResult.data ?? [];

  const greeting = getGreeting();
  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-eyebrow text-ink-subtle mb-1">{today}</p>
        <h1 className="text-headline text-ink">
          {greeting}, {profile?.full_name?.split(" ")[0] ?? "there"}
        </h1>
        {profile?.exam_session && (
          <p className="text-body-sm text-ink-subtle mt-1">
            {profile.exam_session} · {subjects.length} subjects
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Subjects"
          value={subjects.length}
          icon={BookOpen}
          sublabel={`${subjects.filter((s) => s.level === "HL").length} HL · ${subjects.filter((s) => s.level === "SL").length} SL`}
        />
        <StatCard
          label="Open Tasks"
          value={tasks.length}
          icon={CheckSquare}
          sublabel="due soon"
        />
        <StatCard
          label="IAs"
          value={ias.length}
          icon={ClipboardList}
          sublabel={`${ias.filter((ia) => ia.status === "submitted").length} submitted`}
        />
        <StatCard
          label="Exam Session"
          value={profile?.exam_session?.split(" ")[0] ?? "—"}
          icon={Calendar}
          sublabel={profile?.exam_session?.split(" ")[1] ?? ""}
        />
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming tasks */}
        <div className="bg-surface-1 border border-hairline rounded-lg p-5">
          <h2 className="text-card-title text-ink mb-4">Upcoming Tasks</h2>
          {tasks.length === 0 ? (
            <p className="text-body-sm text-ink-subtle">No upcoming tasks. Add one in Calendar.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 py-2 border-b border-hairline last:border-0"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${priorityColor(task.priority)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm text-ink truncate">{task.title}</p>
                    {task.due_date && (
                      <p className="text-caption text-ink-subtle">
                        {format(new Date(task.due_date), "MMM d")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* IA Progress */}
        <div className="bg-surface-1 border border-hairline rounded-lg p-5">
          <h2 className="text-card-title text-ink mb-4">IA Progress</h2>
          {ias.length === 0 ? (
            <p className="text-body-sm text-ink-subtle">No IAs tracked yet.</p>
          ) : (
            <div className="space-y-3">
              {ias.slice(0, 5).map((ia) => {
                const subject = subjects.find((s) => s.id === ia.subject_id);
                return (
                  <div key={ia.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-ink truncate">
                        {subject?.subject_name ?? "Unknown subject"}
                      </p>
                      <p className="text-caption text-ink-subtle">
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
        <div className="bg-surface-1 border border-hairline rounded-lg p-5 lg:col-span-2">
          <h2 className="text-card-title text-ink mb-4">Your Subjects</h2>
          {subjects.length === 0 ? (
            <p className="text-body-sm text-ink-subtle">No subjects found.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {subjects.map((subject) => (
                <a
                  key={subject.id}
                  href={`/subjects/${subject.id}`}
                  className="flex items-center justify-between px-3 py-2.5 bg-surface-2 border border-hairline rounded-md hover:border-hairline-strong transition-colors group"
                >
                  <span className="text-body-sm text-ink truncate group-hover:text-ink">
                    {subject.subject_name}
                  </span>
                  <span className={`text-caption px-1.5 py-0.5 rounded-sm ml-2 shrink-0 ${subject.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-subtle"}`}>
                    {subject.level}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sublabel,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sublabel?: string;
}) {
  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-ink-tertiary" />
        <span className="text-caption text-ink-subtle">{label}</span>
      </div>
      <p className="text-headline text-ink">{value}</p>
      {sublabel && <p className="text-caption text-ink-subtle mt-0.5">{sublabel}</p>}
    </div>
  );
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
    urgent: "bg-destructive",
  };
  return map[priority] ?? "bg-ink-tertiary";
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
