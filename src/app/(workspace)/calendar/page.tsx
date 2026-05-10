import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import type { Database } from "@/types/database";

type TaskRow = Pick<Database["public"]["Tables"]["tasks"]["Row"], "id" | "title" | "due_date" | "priority" | "completed">;
type MilestoneRow = Pick<Database["public"]["Tables"]["milestones"]["Row"], "id" | "title" | "date" | "type">;
type UpcomingTask = Pick<Database["public"]["Tables"]["tasks"]["Row"], "id" | "title" | "due_date" | "priority" | "completed" | "subject_id">;

export default async function CalendarPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const userId = user.id;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const tasksResult = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, completed")
    .eq("user_id", userId)
    .gte("due_date", monthStart.toISOString())
    .lte("due_date", monthEnd.toISOString());

  const milestonesResult = await supabase
    .from("milestones")
    .select("id, title, date, type")
    .eq("user_id", userId)
    .gte("date", monthStart.toISOString())
    .lte("date", monthEnd.toISOString());

  const tasks: TaskRow[] = tasksResult.data ?? [];
  const milestones: MilestoneRow[] = milestonesResult.data ?? [];

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay(); // 0=Sun

  // Upcoming tasks (next 14 days)
  const upcomingTasks = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, completed, subject_id")
    .eq("user_id", userId)
    .eq("completed", false)
    .gte("due_date", now.toISOString())
    .order("due_date", { ascending: true })
    .limit(10);

  const upcoming: UpcomingTask[] = upcomingTasks.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline text-ink">Calendar & Tasks</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          {format(now, "MMMM yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-surface-1 border border-hairline rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-card-title text-ink">{format(now, "MMMM yyyy")}</h2>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-caption text-ink-subtle py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px">
            {/* Empty cells before month start */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {days.map((day) => {
              const dayTasks = tasks.filter(
                (t) => t.due_date && isSameDay(new Date(t.due_date), day)
              );
              const dayMilestones = milestones.filter(
                (m) => isSameDay(new Date(m.date), day)
              );
              const hasItems = dayTasks.length > 0 || dayMilestones.length > 0;
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`h-10 flex flex-col items-center justify-center rounded-md relative cursor-pointer hover:bg-surface-2 transition-colors ${today ? "bg-primary/10" : ""}`}
                >
                  <span className={`text-caption ${today ? "text-primary font-semibold" : "text-ink-subtle"}`}>
                    {format(day, "d")}
                  </span>
                  {hasItems && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayTasks.length > 0 && (
                        <div className="w-1 h-1 rounded-full bg-primary" />
                      )}
                      {dayMilestones.length > 0 && (
                        <div className="w-1 h-1 rounded-full bg-semantic-success" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-hairline">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-caption text-ink-subtle">Task</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-semantic-success" />
              <span className="text-caption text-ink-subtle">Milestone</span>
            </div>
          </div>
        </div>

        {/* Upcoming tasks list */}
        <div className="bg-surface-1 border border-hairline rounded-lg p-5">
          <h2 className="text-card-title text-ink mb-4">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming tasks"
              description="You're all caught up."
              className="py-8"
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-2.5 py-2 border-b border-hairline last:border-0"
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${priorityDot(task.priority)}`} />
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
      </div>
    </div>
  );
}

function priorityDot(priority: string) {
  const map: Record<string, string> = {
    low: "bg-ink-tertiary",
    medium: "bg-ink-subtle",
    high: "bg-primary",
    urgent: "bg-destructive",
  };
  return map[priority] ?? "bg-ink-tertiary";
}
