import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const user = await requireUser();
  const local = await createClient();

  const [tasksResult, milestonesResult] = await Promise.all([
    local
      .from("tasks")
      .select("id, title, description, due_date, due_time, priority, completed, subject_id, created_at")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
    local
      .from("milestones")
      .select("id, title, date, type, subject_id, created_at")
      .eq("user_id", user.id)
      .order("date", { ascending: true }),
  ]);

  return (
    <CalendarView
      initialTasks={tasksResult.data ?? []}
      initialMilestones={milestonesResult.data ?? []}
    />
  );
}
