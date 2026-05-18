import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/calendar-view";
import type {
  CalendarSubject,
  SchoolScheduleEntry,
} from "@/lib/school-schedule";

export default async function CalendarPage() {
  const user = await requireUser();
  const local = await createClient();

  const [
    tasksResult,
    milestonesResult,
    roadmapResult,
    scheduleResult,
    subjectsResult,
  ] = await Promise.all([
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
    local
      .from("roadmap_items")
      .select("id, title, due_date, category, status, priority, subject_id, hidden, created_at")
      .eq("user_id", user.id)
      .eq("hidden", false)
      .in("status", ["upcoming", "active"])
      .order("due_date", { ascending: true }),
    local
      .from("school_schedule_entries")
      .select("id, weekday, subject, subject_id, start_time, end_time, room, teacher, created_at, updated_at")
      .eq("user_id", user.id),
    local
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("user_id", user.id)
      .order("subject_group", { ascending: true }),
  ]);

  return (
    <CalendarView
      initialTasks={tasksResult.data ?? []}
      initialMilestones={milestonesResult.data ?? []}
      initialRoadmapItems={roadmapResult.data ?? []}
      initialScheduleEntries={(scheduleResult.data ?? []) as SchoolScheduleEntry[]}
      subjects={(subjectsResult.data ?? []) as CalendarSubject[]}
    />
  );
}
