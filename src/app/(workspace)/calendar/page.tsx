import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [tasksResult, milestonesResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true }),
    supabase
      .from("milestones")
      .select("*")
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
