"use client";

import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  GraduationCap,
  ListFilter,
  Link2,
  MapPin,
  Pencil,
  Plus,
  School,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WEEKDAYS,
  minutesToTime,
  sortScheduleEntries,
  timeToMinutes,
  type CalendarSubject,
  type SchoolScheduleEntry,
} from "@/lib/school-schedule";
import { displaySubjectName } from "@/lib/subject-display";

type CalendarMode = "month" | "week" | "day";
type LayerKey = "classes" | "tasks" | "deadlines" | "study";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  completed: boolean;
  subject_id: string | null;
  source_title: string | null;
  source_url: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  type: "exam" | "ia_deadline" | "ee_deadline" | "tok_deadline" | "custom";
  subject_id: string | null;
}

interface RoadmapCalendarItem {
  id: string;
  title: string;
  due_date: string | null;
  category:
    | "exam"
    | "mock_exam"
    | "ia"
    | "ee"
    | "tok"
    | "cas"
    | "revision"
    | "custom";
  status: "upcoming" | "active" | "done" | "deferred";
  priority: "low" | "medium" | "high" | "urgent";
  subject_id: string | null;
  hidden: boolean;
  created_at: string;
}

interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  type: string;
  source: "milestone" | "roadmap";
  priority: "low" | "medium" | "high" | "urgent";
  subject_id: string | null;
}

interface StudyBlock {
  id: string;
  date: string;
  title: string;
  sourceTitle: string;
  start_time: string;
  end_time: string;
  priority: "low" | "medium" | "high" | "urgent";
}

interface DaySummary {
  dateKey: string;
  classes: SchoolScheduleEntry[];
  tasks: Task[];
  deadlines: DeadlineItem[];
  studyBlocks: StudyBlock[];
}

interface CalendarViewProps {
  initialTasks: Task[];
  initialMilestones: Milestone[];
  initialRoadmapItems: RoadmapCalendarItem[];
  initialScheduleEntries: SchoolScheduleEntry[];
  subjects: CalendarSubject[];
}

type ScheduleEntryInput = {
  weekday: number;
  subject: string;
  subject_id: string | null;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher: string | null;
};

type TaskInput = {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: Task["priority"];
  subject_id: string | null;
  source_title: string | null;
  source_url: string | null;
  completed?: boolean;
};

type MutationResult = Promise<{ ok: boolean; error: string | null }>;

type ScheduleImportResult = {
  ok: boolean;
  error: string | null;
  imported: number;
  skipped: number;
  issues: Array<{ row: number; message: string }>;
  processor: "ai" | "deterministic" | null;
  model: string | null;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const VIEW_OPTIONS: Array<{ value: CalendarMode; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

const LAYER_OPTIONS: Array<{ key: LayerKey; label: string }> = [
  { key: "classes", label: "Classes" },
  { key: "tasks", label: "Tasks" },
  { key: "deadlines", label: "Deadlines" },
  { key: "study", label: "Study Blocks" },
];

const PRIORITY_CONFIG = {
  low: { label: "Low", dot: "bg-ink-tertiary", text: "text-ink-tertiary" },
  medium: { label: "Medium", dot: "bg-ink-subtle", text: "text-ink-subtle" },
  high: { label: "High", dot: "bg-primary", text: "text-primary" },
  urgent: { label: "Urgent", dot: "bg-red-500", text: "text-red-400" },
};

const SUBJECT_STYLES = [
  {
    bg: "bg-primary/10",
    border: "border-primary/30",
    dot: "bg-primary",
    text: "text-primary",
  },
  {
    bg: "bg-brand-secure/10",
    border: "border-brand-secure/30",
    dot: "bg-brand-secure",
    text: "text-brand-secure",
  },
  {
    bg: "bg-semantic-success/10",
    border: "border-semantic-success/25",
    dot: "bg-semantic-success",
    text: "text-semantic-success",
  },
  {
    bg: "bg-ink-subtle/10",
    border: "border-ink-subtle/25",
    dot: "bg-ink-subtle",
    text: "text-ink-subtle",
  },
  {
    bg: "bg-surface-3",
    border: "border-hairline-strong",
    dot: "bg-ink-tertiary",
    text: "text-ink-muted",
  },
];

const NAMED_SUBJECT_STYLES: Record<string, (typeof SUBJECT_STYLES)[number]> = {
  biology: {
    bg: "bg-green-500/10",
    border: "border-green-400/30",
    dot: "bg-green-400",
    text: "text-green-300",
  },
  spanish: {
    bg: "bg-red-500/10",
    border: "border-red-400/30",
    dot: "bg-red-400",
    text: "text-red-300",
  },
  math: {
    bg: "bg-purple-500/10",
    border: "border-purple-400/30",
    dot: "bg-purple-400",
    text: "text-purple-300",
  },
  mathematics: {
    bg: "bg-purple-500/10",
    border: "border-purple-400/30",
    dot: "bg-purple-400",
    text: "text-purple-300",
  },
  economics: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-400/30",
    dot: "bg-yellow-400",
    text: "text-yellow-300",
  },
  "business and management": {
    bg: "bg-blue-500/10",
    border: "border-blue-400/30",
    dot: "bg-blue-400",
    text: "text-blue-300",
  },
  business: {
    bg: "bg-blue-500/10",
    border: "border-blue-400/30",
    dot: "bg-blue-400",
    text: "text-blue-300",
  },
  english: {
    bg: "bg-orange-500/10",
    border: "border-orange-400/30",
    dot: "bg-orange-400",
    text: "text-orange-300",
  },
};

const DAY_START_MINUTES = 7 * 60;
const DAY_END_MINUTES = 19 * 60;
const HOUR_HEIGHT = 44;
const STUDY_DURATION_MINUTES = 50;

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const mondayOffset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - mondayOffset);
  return next;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatLongDate(dateKey: string) {
  return dateFromKey(dateKey).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getMonthGridDays(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<{ dateKey: string; inMonth: boolean }> = [];

  for (let index = 0; index < startOffset; index++) {
    const date = addDays(firstDay, index - startOffset);
    cells.push({ dateKey: formatDateKey(date), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      dateKey: formatDateKey(new Date(year, month, day)),
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const last = dateFromKey(cells[cells.length - 1]!.dateKey);
    cells.push({ dateKey: formatDateKey(addDays(last, 1)), inMonth: false });
  }

  return cells;
}

function getWeekDays(viewDate: Date) {
  const start = startOfWeek(viewDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { date, dateKey: formatDateKey(date) };
  });
}

function getWeekdayLabel(value: number) {
  return WEEKDAYS.find((day) => day.value === value)?.short ?? "Day";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getSubjectStyle(subject: string) {
  const namedStyle = getNamedSubjectStyle(subject);
  if (namedStyle) return namedStyle;

  return SUBJECT_STYLES[hashString(subject) % SUBJECT_STYLES.length]!;
}

function getNamedSubjectStyle(subject: string) {
  const key = normalizeSubjectStyleKey(subject);
  if (NAMED_SUBJECT_STYLES[key]) return NAMED_SUBJECT_STYLES[key];
  if (key.includes("biology")) return NAMED_SUBJECT_STYLES.biology;
  if (key.includes("spanish")) return NAMED_SUBJECT_STYLES.spanish;
  if (key.includes("math")) return NAMED_SUBJECT_STYLES.math;
  if (key.includes("economics")) return NAMED_SUBJECT_STYLES.economics;
  if (key.includes("business")) return NAMED_SUBJECT_STYLES.business;
  if (key.includes("english")) return NAMED_SUBJECT_STYLES.english;
  return null;
}

function normalizeSubjectStyleKey(subject: string) {
  return subject
    .toLowerCase()
    .replace(/\b(?:hl|sl)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dayDifference(fromDateKey: string, toDateKey: string) {
  const diff =
    dateFromKey(toDateKey).getTime() - dateFromKey(fromDateKey).getTime();
  return Math.round(diff / 86_400_000);
}

function buildDeadlines(
  milestones: Milestone[],
  roadmapItems: RoadmapCalendarItem[],
): DeadlineItem[] {
  const milestoneDeadlines = milestones.map((milestone) => ({
    id: `milestone-${milestone.id}`,
    title: milestone.title,
    date: milestone.date,
    type: milestone.type.replace("_", " "),
    source: "milestone" as const,
    priority: "high" as const,
    subject_id: milestone.subject_id,
  }));

  const roadmapDeadlines = roadmapItems
    .filter((item) => item.due_date && !item.hidden && item.status !== "done")
    .map((item) => ({
      id: `roadmap-${item.id}`,
      title: item.title,
      date: item.due_date!,
      type: item.category.replace("_", " "),
      source: "roadmap" as const,
      priority: item.priority,
      subject_id: item.subject_id,
    }));

  return [...milestoneDeadlines, ...roadmapDeadlines].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

function buildStudyCandidates(tasks: Task[], deadlines: DeadlineItem[]) {
  const taskCandidates = tasks
    .filter((task) => !task.completed && task.due_date)
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      date: task.due_date!,
      priority: task.priority,
    }));

  const deadlineCandidates = deadlines.map((deadline) => ({
    id: deadline.id,
    title: deadline.title,
    date: deadline.date,
    priority: deadline.priority,
  }));

  const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

  return [...taskCandidates, ...deadlineCandidates].sort((a, b) => {
    const dateSort = a.date.localeCompare(b.date);
    if (dateSort !== 0) return dateSort;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });
}

function classesForDate(entries: SchoolScheduleEntry[], dateKey: string) {
  const weekday = dateFromKey(dateKey).getDay();
  return sortScheduleEntries(
    entries.filter((entry) => entry.weekday === weekday),
  );
}

function findStudySlot(classes: SchoolScheduleEntry[], dateKey: string) {
  const weekday = dateFromKey(dateKey).getDay();
  const sorted = [...classes].sort((a, b) =>
    a.start_time.localeCompare(b.start_time),
  );

  if (sorted.length === 0) {
    if (weekday === 0 || weekday === 6) return null;
    return { start: 16 * 60, end: 16 * 60 + STUDY_DURATION_MINUTES };
  }

  for (let index = 0; index < sorted.length - 1; index++) {
    const gapStart = timeToMinutes(sorted[index]!.end_time) + 10;
    const gapEnd = timeToMinutes(sorted[index + 1]!.start_time) - 10;
    if (gapEnd - gapStart >= 45) {
      return {
        start: gapStart,
        end: gapStart + Math.min(STUDY_DURATION_MINUTES, gapEnd - gapStart),
      };
    }
  }

  const afterLast = Math.max(
    timeToMinutes(sorted[sorted.length - 1]!.end_time) + 20,
    15 * 60,
  );
  if (DAY_END_MINUTES - afterLast >= 45) {
    return {
      start: afterLast,
      end:
        afterLast +
        Math.min(STUDY_DURATION_MINUTES, DAY_END_MINUTES - afterLast),
    };
  }

  const beforeFirstEnd = timeToMinutes(sorted[0]!.start_time) - 10;
  if (beforeFirstEnd - DAY_START_MINUTES >= 45) {
    return {
      start: DAY_START_MINUTES,
      end:
        DAY_START_MINUTES +
        Math.min(STUDY_DURATION_MINUTES, beforeFirstEnd - DAY_START_MINUTES),
    };
  }

  return null;
}

function studyBlocksForDate(
  dateKey: string,
  classes: SchoolScheduleEntry[],
  candidates: ReturnType<typeof buildStudyCandidates>,
  todayKey: string,
): StudyBlock[] {
  if (dateKey < todayKey) return [];

  const candidate = candidates.find((item) => {
    const daysUntilDue = dayDifference(dateKey, item.date);
    return daysUntilDue >= 0 && daysUntilDue <= 14;
  });

  if (!candidate) return [];

  const slot = findStudySlot(classes, dateKey);
  if (!slot) return [];

  return [
    {
      id: `study-${dateKey}-${candidate.id}`,
      date: dateKey,
      title: "Focused study",
      sourceTitle: candidate.title,
      start_time: minutesToTime(slot.start),
      end_time: minutesToTime(slot.end),
      priority: candidate.priority,
    },
  ];
}

function eventPosition(startTime: string, endTime: string) {
  const start = Math.max(timeToMinutes(startTime), DAY_START_MINUTES);
  const end = Math.min(timeToMinutes(endTime), DAY_END_MINUTES);
  const top = ((start - DAY_START_MINUTES) / 60) * HOUR_HEIGHT;
  const height = Math.max(28, ((end - start) / 60) * HOUR_HEIGHT - 4);
  return { top, height };
}

function timeRange(startTime: string | null, endTime?: string | null) {
  if (!startTime) return "All day";
  return endTime ? `${startTime}-${endTime}` : startTime;
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const leftDate = a.due_date ?? "9999-12-31";
    const rightDate = b.due_date ?? "9999-12-31";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    return (a.due_time ?? "23:59").localeCompare(b.due_time ?? "23:59");
  });
}

export function CalendarView({
  initialTasks,
  initialMilestones,
  initialRoadmapItems,
  initialScheduleEntries,
  subjects,
}: CalendarViewProps) {
  const now = new Date();
  const todayKey = formatDateKey(now);
  const [viewMode, setViewMode] = useState<CalendarMode>("month");
  const [viewDate, setViewDate] = useState(now);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [scheduleEntries, setScheduleEntries] = useState<SchoolScheduleEntry[]>(
    sortScheduleEntries(initialScheduleEntries),
  );
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    classes: true,
    tasks: true,
    deadlines: true,
    study: true,
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showScheduleSetup, setShowScheduleSetup] = useState(false);
  const [motionDirection, setMotionDirection] = useState(0);

  const deadlines = useMemo(
    () => buildDeadlines(initialMilestones, initialRoadmapItems),
    [initialMilestones, initialRoadmapItems],
  );

  const studyCandidates = useMemo(
    () => buildStudyCandidates(tasks, deadlines),
    [tasks, deadlines],
  );

  const monthCells = useMemo(() => getMonthGridDays(viewDate), [viewDate]);
  const weekDays = useMemo(() => getWeekDays(viewDate), [viewDate]);
  const openTasks = tasks.filter((task) => !task.completed);
  const overdueTasks = openTasks.filter(
    (task) => task.due_date && task.due_date < todayKey,
  );

  const getDaySummary = useCallback(
    (dateKey: string): DaySummary => {
      const classes = classesForDate(scheduleEntries, dateKey);
      const dayTasks = tasks.filter(
        (task) => !task.completed && task.due_date === dateKey,
      );
      const dayDeadlines = deadlines.filter(
        (deadline) => deadline.date === dateKey,
      );

      return {
        dateKey,
        classes,
        tasks: dayTasks,
        deadlines: dayDeadlines,
        studyBlocks: studyBlocksForDate(
          dateKey,
          classes,
          studyCandidates,
          todayKey,
        ),
      };
    },
    [deadlines, scheduleEntries, studyCandidates, tasks, todayKey],
  );

  const selectedSummary = getDaySummary(selectedDate);

  const viewTitle = useMemo(() => {
    if (viewMode === "month") {
      return `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    }
    if (viewMode === "week") {
      const start = startOfWeek(viewDate);
      const end = addDays(start, 6);
      return `${formatShortDate(start)} - ${formatShortDate(end)}`;
    }
    return formatLongDate(formatDateKey(viewDate));
  }, [viewDate, viewMode]);

  const moveView = (direction: -1 | 1) => {
    setMotionDirection(direction);
    const next =
      viewMode === "month"
        ? new Date(viewDate.getFullYear(), viewDate.getMonth() + direction, 1)
        : addDays(viewDate, viewMode === "week" ? direction * 7 : direction);
    const nextKey = formatDateKey(next);
    setViewDate(next);
    setSelectedDate(nextKey);
  };

  const selectDate = (dateKey: string) => {
    setSelectedDate(dateKey);
    setViewDate(dateFromKey(dateKey));
  };

  const changeMode = (mode: CalendarMode) => {
    setViewMode(mode);
    setViewDate(dateFromKey(selectedDate));
  };

  const toggleTask = useCallback(async (id: string, completed: boolean) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, completed } : task)),
    );
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
  }, []);

  const addTask = useCallback(async (task: TaskInput) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (res.ok) {
      const data = (await res.json()) as { task: Task };
      setTasks((prev) => sortTasks([...prev, data.task]));
      setShowAddTask(false);
      return { ok: true, error: null };
    }
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { ok: false, error: data?.error ?? "Could not create this task." };
  }, []);

  const updateTask = useCallback(async (id: string, task: TaskInput) => {
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...task }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { ok: false, error: data?.error ?? "Could not update this task." };
    }

    const data = (await response.json()) as { task: Task };
    setTasks((prev) =>
      sortTasks(prev.map((item) => (item.id === id ? data.task : item))),
    );
    setEditingTask(null);
    return { ok: true, error: null };
  }, []);

  const addScheduleEntry = useCallback(async (entry: ScheduleEntryInput) => {
    const response = await fetch("/api/school-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { ok: false, error: data?.error ?? "Could not save this class." };
    }

    const data = (await response.json()) as { entry: SchoolScheduleEntry };
    setScheduleEntries((prev) => sortScheduleEntries([...prev, data.entry]));
    return { ok: true, error: null };
  }, []);

  const deleteScheduleEntry = useCallback(async (id: string) => {
    const response = await fetch(`/api/school-schedule?id=${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        ok: false,
        error: data?.error ?? "Could not delete this class.",
      };
    }
    setScheduleEntries((prev) => prev.filter((entry) => entry.id !== id));
    return { ok: true, error: null };
  }, []);

  const importScheduleFile = useCallback(
    async (file: File, replace: boolean): Promise<ScheduleImportResult> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("replace", String(replace));

      const response = await fetch("/api/school-schedule/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as {
        entries?: SchoolScheduleEntry[];
        imported?: number;
        skipped_duplicates?: number;
        issues?: Array<{ row: number; message: string }>;
        processor?: "ai" | "deterministic";
        model?: string | null;
        error?: string;
      } | null;

      if (!response.ok) {
        return {
          ok: false,
          error: data?.error ?? "Could not import this schedule file.",
          imported: 0,
          skipped: 0,
          issues: data?.issues ?? [],
          processor: data?.processor ?? null,
          model: data?.model ?? null,
        };
      }

      const importedEntries = data?.entries ?? [];
      setScheduleEntries((prev) =>
        replace
          ? importedEntries
          : sortScheduleEntries([...prev, ...importedEntries]),
      );

      return {
        ok: true,
        error: null,
        imported: data?.imported ?? importedEntries.length,
        skipped: data?.skipped_duplicates ?? 0,
        issues: data?.issues ?? [],
        processor: data?.processor ?? null,
        model: data?.model ?? null,
      };
    },
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-headline text-ink">Calendar & Tasks</h1>
          <p className="mt-1 text-body-sm text-ink-subtle">
            {openTasks.length} open tasks
            {overdueTasks.length > 0 && (
              <span className="ml-2 text-red-400">
                {overdueTasks.length} overdue
              </span>
            )}
            <span className="ml-2">
              {scheduleEntries.length} scheduled classes
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (!selectedDate) setSelectedDate(todayKey);
              setShowAddTask(true);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 py-2 text-button text-on-primary hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Add Task
          </motion.button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full rounded-md border border-hairline bg-surface-2 p-0.5 lg:w-auto">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => changeMode(option.value)}
              className={cn(
                "min-h-8 flex-1 rounded-[6px] px-3 text-caption transition-colors lg:flex-none",
                viewMode === option.value
                  ? "bg-surface-4 text-ink"
                  : "text-ink-subtle hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {LAYER_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() =>
                  setLayers((prev) => ({
                    ...prev,
                    [option.key]: !prev[option.key],
                  }))
                }
                className={cn(
                  "min-h-8 rounded-md border px-2.5 text-caption transition-colors",
                  layers[option.key]
                    ? "border-hairline-strong bg-surface-3 text-ink-subtle"
                    : "border-transparent bg-surface-2/60 text-ink-tertiary hover:text-ink-subtle",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowScheduleSetup(true)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface-2/60 px-2.5 text-caption text-ink-subtle transition-colors hover:border-hairline-strong hover:text-ink"
          >
            <School className="h-3.5 w-3.5" />
            Schedule
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-hairline bg-surface-1 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={`${viewMode}-${viewTitle}`}
                initial={{ opacity: 0, x: motionDirection * 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: motionDirection * -12 }}
                transition={{ duration: 0.18 }}
                className="text-card-title text-ink"
              >
                {viewTitle}
              </motion.h2>
            </AnimatePresence>
            <div className="flex items-center gap-1">
              <button
                onClick={() => moveView(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
                aria-label="Previous calendar range"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewDate(now);
                  setSelectedDate(todayKey);
                }}
                className="min-h-9 rounded-md px-3 text-caption text-ink-subtle hover:bg-surface-2 hover:text-ink"
              >
                Today
              </button>
              <button
                onClick={() => moveView(1)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
                aria-label="Next calendar range"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {viewMode === "month" && (
            <MonthLayerView
              cells={monthCells}
              viewDate={viewDate}
              selectedDate={selectedDate}
              todayKey={todayKey}
              layers={layers}
              getDaySummary={getDaySummary}
              onSelectDate={selectDate}
              motionDirection={motionDirection}
            />
          )}

          {viewMode === "week" && (
            <WeekLayerView
              days={weekDays}
              selectedDate={selectedDate}
              todayKey={todayKey}
              layers={layers}
              getDaySummary={getDaySummary}
              onSelectDate={selectDate}
            />
          )}

          {viewMode === "day" && (
            <DayLayerView
              dateKey={formatDateKey(viewDate)}
              todayKey={todayKey}
              layers={layers}
              summary={getDaySummary(formatDateKey(viewDate))}
            />
          )}
        </div>

        <AgendaPanel
          summary={selectedSummary}
          layers={layers}
          subjects={subjects}
          onToggleTask={toggleTask}
          onEditTask={setEditingTask}
          onDeleteTask={deleteTask}
        />
      </div>

      <AnimatePresence>
        {showAddTask && (
          <AddTaskModal
            defaultDate={selectedDate}
            subjects={subjects}
            onAdd={addTask}
            onClose={() => setShowAddTask(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingTask && (
          <EditTaskModal
            task={editingTask}
            subjects={subjects}
            onSave={(task) => updateTask(editingTask.id, task)}
            onClose={() => setEditingTask(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScheduleSetup && (
          <ScheduleSetupModal
            entries={scheduleEntries}
            subjects={subjects}
            onAdd={addScheduleEntry}
            onDelete={deleteScheduleEntry}
            onImport={importScheduleFile}
            onClose={() => setShowScheduleSetup(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MonthLayerView({
  cells,
  viewDate,
  selectedDate,
  todayKey,
  layers,
  getDaySummary,
  onSelectDate,
  motionDirection,
}: {
  cells: Array<{ dateKey: string; inMonth: boolean }>;
  viewDate: Date;
  selectedDate: string;
  todayKey: string;
  layers: Record<LayerKey, boolean>;
  getDaySummary: (dateKey: string) => DaySummary;
  onSelectDate: (dateKey: string) => void;
  motionDirection: number;
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-hairline pb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day.value}
            className="px-1 py-1 text-center text-caption text-ink-tertiary"
          >
            {day.short}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${viewDate.getFullYear()}-${viewDate.getMonth()}`}
          initial={{ opacity: 0, x: motionDirection * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: motionDirection * -20 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-7 gap-px pt-1"
        >
          {cells.map((cell) => {
            const date = dateFromKey(cell.dateKey);
            const summary = getDaySummary(cell.dateKey);
            const isSelected = selectedDate === cell.dateKey;
            const isToday = todayKey === cell.dateKey;
            const classCount = summary.classes.length;
            const taskCount = summary.tasks.length;
            const deadlineCount = summary.deadlines.length;
            const studyCount = summary.studyBlocks.length;

            return (
              <button
                key={cell.dateKey}
                onClick={() => onSelectDate(cell.dateKey)}
                className={cn(
                  "min-h-[86px] rounded-md border border-transparent p-2 text-left transition-colors",
                  isSelected && "border-primary/70 bg-primary/5",
                  !isSelected && "hover:bg-surface-2/70",
                  !cell.inMonth && "opacity-40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-caption",
                      isToday ? "font-medium text-primary" : "text-ink-subtle",
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {layers.deadlines && deadlineCount > 0 && (
                    <div className="flex gap-0.5">
                      {summary.deadlines.slice(0, 3).map((deadline) => (
                        <span
                          key={deadline.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            PRIORITY_CONFIG[deadline.priority].dot,
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-[11px] leading-tight text-ink-tertiary">
                  {layers.classes && classCount > 0 && (
                    <p>
                      {classCount} class{classCount === 1 ? "" : "es"}
                    </p>
                  )}
                  {layers.tasks && taskCount > 0 && (
                    <p>
                      {taskCount} task{taskCount === 1 ? "" : "s"}
                    </p>
                  )}
                  {layers.study && studyCount > 0 && (
                    <p className="inline-flex items-center gap-1 text-primary">
                      <Sparkles className="h-3 w-3" />
                      {studyCount} study
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WeekLayerView({
  days,
  selectedDate,
  todayKey,
  layers,
  getDaySummary,
  onSelectDate,
}: {
  days: Array<{ date: Date; dateKey: string }>;
  selectedDate: string;
  todayKey: string;
  layers: Record<LayerKey, boolean>;
  getDaySummary: (dateKey: string) => DaySummary;
  onSelectDate: (dateKey: string) => void;
}) {
  const gridHeight = ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) * HOUR_HEIGHT;
  const hours = Array.from(
    { length: DAY_END_MINUTES / 60 - DAY_START_MINUTES / 60 + 1 },
    (_, index) => DAY_START_MINUTES / 60 + index,
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(100px,1fr))] border-b border-hairline">
          <div />
          {days.map((day) => {
            const summary = getDaySummary(day.dateKey);
            return (
              <button
                key={day.dateKey}
                onClick={() => onSelectDate(day.dateKey)}
                className={cn(
                  "min-h-[66px] border-l border-hairline px-2 py-2 text-left hover:bg-surface-2/70",
                  selectedDate === day.dateKey && "bg-primary/5",
                  todayKey === day.dateKey && "text-primary",
                )}
              >
                <p className="text-caption text-ink-tertiary">
                  {
                    WEEKDAYS.find((item) => item.value === day.date.getDay())
                      ?.short
                  }
                </p>
                <p className="text-body-sm font-medium text-ink">
                  {formatShortDate(day.date)}
                </p>
                <MarkerStrip summary={summary} layers={layers} />
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-[56px_repeat(7,minmax(100px,1fr))]">
          <div
            className="relative border-r border-hairline"
            style={{ height: gridHeight }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] text-ink-tertiary"
                style={{
                  top: (hour - DAY_START_MINUTES / 60) * HOUR_HEIGHT - 6,
                }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const summary = getDaySummary(day.dateKey);
            return (
              <TimeColumn
                key={day.dateKey}
                summary={summary}
                layers={layers}
                height={gridHeight}
                hours={hours}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayLayerView({
  dateKey,
  todayKey,
  layers,
  summary,
}: {
  dateKey: string;
  todayKey: string;
  layers: Record<LayerKey, boolean>;
  summary: DaySummary;
}) {
  const gridHeight = ((DAY_END_MINUTES - DAY_START_MINUTES) / 60) * HOUR_HEIGHT;
  const hours = Array.from(
    { length: DAY_END_MINUTES / 60 - DAY_START_MINUTES / 60 + 1 },
    (_, index) => DAY_START_MINUTES / 60 + index,
  );

  return (
    <div>
      <div
        className={cn(
          "mb-3 rounded-md border border-hairline bg-surface-2 p-3",
          todayKey === dateKey && "border-primary/30",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-caption text-ink-tertiary">Day agenda</p>
            <p className="text-body-sm font-medium text-ink">
              {formatLongDate(dateKey)}
            </p>
          </div>
          <MarkerStrip summary={summary} layers={layers} />
        </div>
      </div>

      <div className="grid grid-cols-[56px_minmax(0,1fr)]">
        <div
          className="relative border-r border-hairline"
          style={{ height: gridHeight }}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute right-2 text-[10px] text-ink-tertiary"
              style={{ top: (hour - DAY_START_MINUTES / 60) * HOUR_HEIGHT - 6 }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <TimeColumn
          summary={summary}
          layers={layers}
          height={gridHeight}
          hours={hours}
        />
      </div>
    </div>
  );
}

function TimeColumn({
  summary,
  layers,
  height,
  hours,
}: {
  summary: DaySummary;
  layers: Record<LayerKey, boolean>;
  height: number;
  hours: number[];
}) {
  return (
    <div className="relative border-l border-hairline/70" style={{ height }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-hairline/70"
          style={{ top: (hour - DAY_START_MINUTES / 60) * HOUR_HEIGHT }}
        />
      ))}

      {layers.classes &&
        summary.classes.map((entry) => (
          <ClassBlock key={entry.id} entry={entry} />
        ))}

      {layers.study &&
        summary.studyBlocks.map((block) => (
          <StudyBlockItem key={block.id} block={block} />
        ))}
    </div>
  );
}

function ClassBlock({ entry }: { entry: SchoolScheduleEntry }) {
  const position = eventPosition(entry.start_time, entry.end_time);
  const subjectName = displaySubjectName(entry.subject);
  const style = getSubjectStyle(subjectName);

  return (
    <div
      className={cn(
        "absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1.5",
        style.bg,
        style.border,
      )}
      style={{ top: position.top, height: position.height }}
    >
      <div className="flex items-start gap-1.5">
        <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", style.dot)} />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-tight text-ink">
            {subjectName}
          </p>
        </div>
      </div>
    </div>
  );
}

function StudyBlockItem({ block }: { block: StudyBlock }) {
  const position = eventPosition(block.start_time, block.end_time);

  return (
    <div
      className="absolute left-2 right-2 overflow-hidden rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5"
      style={{ top: position.top, height: position.height }}
    >
      <div className="flex items-start gap-1.5">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-tight text-ink">
            {block.title}
          </p>
          <p className="truncate text-[10px] leading-tight text-ink-tertiary">
            {block.sourceTitle}
          </p>
        </div>
      </div>
    </div>
  );
}

function MarkerStrip({
  summary,
  layers,
}: {
  summary: DaySummary;
  layers: Record<LayerKey, boolean>;
}) {
  const dots: Array<{ id: string; className: string; label: string }> = [];

  if (layers.tasks && summary.tasks.length > 0) {
    dots.push({
      id: "tasks",
      className: "bg-primary",
      label: `${summary.tasks.length} tasks`,
    });
  }
  if (layers.deadlines && summary.deadlines.length > 0) {
    dots.push({
      id: "deadlines",
      className: "bg-semantic-success",
      label: `${summary.deadlines.length} deadlines`,
    });
  }
  if (layers.study && summary.studyBlocks.length > 0) {
    dots.push({ id: "study", className: "bg-brand-secure", label: "Study" });
  }

  if (dots.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {dots.map((dot) => (
        <span
          key={dot.id}
          className="inline-flex items-center gap-1 text-[10px] text-ink-tertiary"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", dot.className)} />
          {dot.label}
        </span>
      ))}
    </div>
  );
}

function AgendaPanel({
  summary,
  layers,
  subjects,
  onToggleTask,
  onEditTask,
  onDeleteTask,
}: {
  summary: DaySummary;
  layers: Record<LayerKey, boolean>;
  subjects: CalendarSubject[];
  onToggleTask: (id: string, completed: boolean) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
}) {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const visibleCount =
    (layers.classes ? summary.classes.length : 0) +
    (layers.tasks ? summary.tasks.length : 0) +
    (layers.deadlines ? summary.deadlines.length : 0) +
    (layers.study ? summary.studyBlocks.length : 0);

  return (
    <aside className="rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-caption text-ink-tertiary">Selected day</p>
          <h3 className="text-body-sm font-medium text-ink">
            {formatLongDate(summary.dateKey)}
          </h3>
        </div>
        <ListFilter className="h-4 w-4 text-ink-tertiary" />
      </div>

      {visibleCount === 0 ? (
        <p className="rounded-md border border-dashed border-hairline p-4 text-center text-caption text-ink-subtle">
          No visible calendar items for this day.
        </p>
      ) : (
        <div className="space-y-4">
          {layers.classes && summary.classes.length > 0 && (
            <AgendaSection title="Classes" icon={School}>
              {summary.classes.map((entry) => {
                const subjectName = displaySubjectName(entry.subject);
                const style = getSubjectStyle(subjectName);
                return (
                  <div
                    key={entry.id}
                    className="rounded-md border border-hairline bg-surface-2 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn("mt-1.5 h-2 w-2 rounded-full", style.dot)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-medium text-ink">
                          {subjectName}
                        </p>
                        <p className="mt-0.5 text-caption text-ink-tertiary">
                          {timeRange(entry.start_time, entry.end_time)}
                          {entry.room ? ` / Room ${entry.room}` : ""}
                        </p>
                        {entry.teacher && (
                          <p className="mt-0.5 text-caption text-ink-tertiary">
                            {entry.teacher}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </AgendaSection>
          )}

          {layers.study && summary.studyBlocks.length > 0 && (
            <AgendaSection title="Study Blocks" icon={Sparkles}>
              {summary.studyBlocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3"
                >
                  <p className="text-body-sm font-medium text-ink">
                    {block.title}
                  </p>
                  <p className="mt-0.5 text-caption text-ink-tertiary">
                    {timeRange(block.start_time, block.end_time)} /{" "}
                    {block.sourceTitle}
                  </p>
                </div>
              ))}
            </AgendaSection>
          )}

          {layers.tasks && summary.tasks.length > 0 && (
            <AgendaSection title="Tasks" icon={Check}>
              {summary.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  subject={subjectById.get(task.subject_id ?? "")}
                  onToggle={onToggleTask}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                />
              ))}
            </AgendaSection>
          )}

          {layers.deadlines && summary.deadlines.length > 0 && (
            <AgendaSection title="Academic Deadlines" icon={GraduationCap}>
              {summary.deadlines.map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full",
                      PRIORITY_CONFIG[deadline.priority].dot,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-ink">
                      {deadline.title}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-tertiary">
                      {deadline.type}
                      {deadline.subject_id &&
                      subjectById.get(deadline.subject_id)
                        ? ` / ${displaySubjectName(subjectById.get(deadline.subject_id)!.subject_name)}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </AgendaSection>
          )}
        </div>
      )}
    </aside>
  );
}

function AgendaSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof School;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-caption text-ink-subtle">
        <Icon className="h-3.5 w-3.5" />
        <h4>{title}</h4>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function TaskRow({
  task,
  subject,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  subject?: CalendarSubject;
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const config = PRIORITY_CONFIG[task.priority];
  const sourceLabel = task.source_title ?? task.source_url;

  return (
    <div className="group flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-2">
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors",
          task.completed ? "bg-primary/10" : "hover:bg-surface-3",
        )}
        aria-label={
          task.completed ? "Mark task incomplete" : "Mark task complete"
        }
      >
        <motion.div
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border transition-colors",
            task.completed
              ? "border-primary bg-primary"
              : "border-hairline-strong",
          )}
          animate={task.completed ? { scale: [1, 1.12, 1] } : {}}
          transition={{ duration: 0.18 }}
        >
          {task.completed && <Check className="h-3 w-3 text-on-primary" />}
        </motion.div>
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="block w-full text-left"
        >
          <p
            className={cn(
              "truncate text-body-sm",
              task.completed ? "text-ink-tertiary line-through" : "text-ink",
            )}
          >
            {task.title}
          </p>
        </button>
        <p className="text-caption text-ink-tertiary">
          {task.due_time
            ? task.due_time
            : task.due_date
              ? "Due today"
              : "No due time"}
          {subject ? ` / ${displaySubjectName(subject.subject_name)}` : ""}
        </p>
        {task.description && (
          <p className="mt-1 line-clamp-2 text-caption text-ink-subtle">
            {task.description}
          </p>
        )}
        {sourceLabel && (
          <p className="mt-1 flex items-center gap-1 truncate text-caption text-ink-tertiary">
            <Link2 className="h-3 w-3 shrink-0" />
            {sourceLabel}
          </p>
        )}
      </div>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
      <button
        onClick={() => onEdit(task)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2/50 text-ink-tertiary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-primary/50"
        aria-label="Edit task"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onDelete(task.id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2/50 text-ink-tertiary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-primary/50"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddTaskModal({
  defaultDate,
  subjects,
  onAdd,
  onClose,
}: {
  defaultDate: string;
  subjects: CalendarSubject[];
  onAdd: (task: TaskInput) => MutationResult;
  onClose: () => void;
}) {
  return (
    <TaskFormModal
      title="New Task"
      defaultDate={defaultDate}
      subjects={subjects}
      submitLabel="Create Task"
      onSubmit={onAdd}
      onClose={onClose}
    />
  );
}

function EditTaskModal({
  task,
  subjects,
  onSave,
  onClose,
}: {
  task: Task;
  subjects: CalendarSubject[];
  onSave: (task: TaskInput) => MutationResult;
  onClose: () => void;
}) {
  return (
    <TaskFormModal
      title="Edit Task"
      task={task}
      defaultDate={task.due_date ?? formatDateKey(new Date())}
      subjects={subjects}
      submitLabel="Save Task"
      onSubmit={onSave}
      onClose={onClose}
    />
  );
}

function TaskFormModal({
  title: modalTitle,
  task,
  defaultDate,
  subjects,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  task?: Task;
  defaultDate: string;
  subjects: CalendarSubject[];
  submitLabel: string;
  onSubmit: (task: TaskInput) => MutationResult;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaultDate);
  const [dueTime, setDueTime] = useState(task?.due_time ?? "");
  const [subjectId, setSubjectId] = useState(task?.subject_id ?? "");
  const [sourceTitle, setSourceTitle] = useState(task?.source_title ?? "");
  const [sourceUrl, setSourceUrl] = useState(task?.source_url ?? "");
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [priority, setPriority] = useState<keyof typeof PRIORITY_CONFIG>(
    task?.priority ?? "medium",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setError(null);

    const result = await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      priority,
      subject_id: subjectId || null,
      source_title: sourceTitle.trim() || null,
      source_url: sourceUrl.trim() || null,
      completed,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-semantic-overlay/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-6"
        >
          <ModalHeader title={modalTitle} onClose={onClose} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldLabel label="Title">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Finish Chemistry IA draft"
                className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
                autoFocus={!task}
              />
            </FieldLabel>

            <FieldLabel label="What needs to be done">
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="List the concrete work, criteria, or next step."
                rows={4}
                className="w-full resize-y rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
              />
            </FieldLabel>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldLabel label="Due date">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 py-2.5 pl-9 pr-3 text-body-sm text-ink focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
                  />
                </div>
              </FieldLabel>

              <FieldLabel label="Due time optional">
                <TimeInput value={dueTime} onChange={setDueTime} icon={Clock} />
              </FieldLabel>
            </div>

            <FieldLabel label="Subject optional">
              <select
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
              >
                <option value="">No subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {displaySubjectName(subject.subject_name)}
                    {subject.level ? ` ${subject.level}` : ""}
                  </option>
                ))}
              </select>
            </FieldLabel>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldLabel label="Source optional">
                <TextInput
                  value={sourceTitle}
                  onChange={setSourceTitle}
                  icon={FileText}
                  placeholder="Syllabus page, note, or document"
                />
              </FieldLabel>
              <FieldLabel label="Source link optional">
                <TextInput
                  value={sourceUrl}
                  onChange={setSourceUrl}
                  icon={Link2}
                  placeholder="https:// or local reference"
                />
              </FieldLabel>
            </div>

            <FieldLabel label="Priority">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  Object.keys(PRIORITY_CONFIG) as Array<
                    keyof typeof PRIORITY_CONFIG
                  >
                ).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setPriority(option)}
                    className={cn(
                      "flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-2 text-caption transition-colors",
                      priority === option
                        ? "border-primary bg-primary/10 text-ink"
                        : "border-hairline text-ink-subtle hover:border-hairline-strong",
                    )}
                  >
                    <Flag
                      className={cn("h-3 w-3", PRIORITY_CONFIG[option].text)}
                    />
                    {PRIORITY_CONFIG[option].label}
                  </button>
                ))}
              </div>
            </FieldLabel>

            {task && (
              <label className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-body-sm text-ink">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(event) => setCompleted(event.target.checked)}
                  className="h-4 w-4 rounded border-hairline bg-surface-1 accent-primary"
                />
                Completed
              </label>
            )}

            {error && (
              <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-caption text-red-400">
                {error}
              </p>
            )}

            <ModalActions
              submitLabel={pending ? "Saving..." : submitLabel}
              submitDisabled={pending || !title.trim()}
              onClose={onClose}
            />
          </form>
        </motion.div>
      </div>
    </>
  );
}

function ScheduleSetupModal({
  entries,
  subjects,
  onAdd,
  onDelete,
  onImport,
  onClose,
}: {
  entries: SchoolScheduleEntry[];
  subjects: CalendarSubject[];
  onAdd: (
    entry: ScheduleEntryInput,
  ) => Promise<{ ok: boolean; error: string | null }>;
  onDelete: (id: string) => Promise<{ ok: boolean; error: string | null }>;
  onImport: (file: File, replace: boolean) => Promise<ScheduleImportResult>;
  onClose: () => void;
}) {
  const [weekday, setWeekday] = useState(1);
  const [subject, setSubject] = useState(
    displaySubjectName(subjects[0]?.subject_name),
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [replaceSchedule, setReplaceSchedule] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importResult, setImportResult] = useState<ScheduleImportResult | null>(
    null,
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const matchedSubject = subjects.find(
      (item) =>
        item.subject_name.toLowerCase() === subject.trim().toLowerCase() ||
        displaySubjectName(item.subject_name).toLowerCase() ===
          subject.trim().toLowerCase(),
    );

    setPending(true);
    const result = await onAdd({
      weekday,
      subject: displaySubjectName(subject.trim()),
      subject_id: matchedSubject?.id ?? null,
      start_time: startTime,
      end_time: endTime,
      room: room.trim() || null,
      teacher: teacher.trim() || null,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setRoom("");
    setTeacher("");
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const result = await onDelete(id);
    if (!result.ok) setError(result.error);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setError(null);
    setImportResult(null);
    setImportPending(true);
    const result = await onImport(importFile, replaceSchedule);
    setImportPending(false);
    setImportResult(result);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setImportFile(null);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-semantic-overlay/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto grid max-h-[88vh] w-full max-w-3xl grid-cols-1 overflow-hidden rounded-lg border border-hairline bg-surface-1 lg:grid-cols-[minmax(0,1fr)_300px]"
        >
          <div className="p-6">
            <ModalHeader title="Import Schedule" onClose={onClose} />
            <div className="mb-5 rounded-md border border-hairline bg-surface-2 p-3">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="text-body-sm font-medium text-ink">
                  Analyze schedule import
                </h4>
              </div>
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={(event) =>
                    setImportFile(event.target.files?.[0] ?? null)
                  }
                  className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-caption text-ink file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-caption file:text-on-primary"
                />
                <label className="flex items-center gap-2 text-caption text-ink-subtle">
                  <input
                    type="checkbox"
                    checked={replaceSchedule}
                    onChange={(event) =>
                      setReplaceSchedule(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-hairline bg-surface-1 accent-primary"
                  />
                  Replace saved classes before import
                </label>
                <button
                  type="button"
                  disabled={!importFile || importPending}
                  onClick={handleImport}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 py-2 text-button text-on-primary hover:bg-primary-hover disabled:opacity-50"
                >
                  {importPending ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {importPending ? "Analyzing..." : "Analyze & Import"}
                </button>
                {importResult?.ok && (
                  <p className="text-caption text-ink-subtle">
                    Imported {importResult.imported} classes
                    {importResult.skipped > 0
                      ? ` / ${importResult.skipped} duplicates skipped`
                      : ""}
                    {importResult.processor === "ai" && importResult.model
                      ? ` / cleaned with ${importResult.model}`
                      : importResult.processor === "deterministic"
                        ? " / parser fallback"
                        : ""}
                  </p>
                )}
                {importResult?.issues && importResult.issues.length > 0 && (
                  <div className="space-y-1 rounded-md border border-hairline bg-surface-1 p-2">
                    {importResult.issues.slice(0, 3).map((issue) => (
                      <p
                        key={`${issue.row}-${issue.message}`}
                        className="text-caption text-ink-tertiary"
                      >
                        Row {issue.row}: {issue.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Weekday">
                  <select
                    value={weekday}
                    onChange={(event) => setWeekday(Number(event.target.value))}
                    className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Subject">
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    list="schedule-subjects"
                    placeholder="Chemistry HL"
                    className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
                  />
                  <datalist id="schedule-subjects">
                    {subjects.map((item) => (
                      <option
                        key={item.id}
                        value={displaySubjectName(item.subject_name)}
                      />
                    ))}
                  </datalist>
                </FieldLabel>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Start time">
                  <TimeInput
                    value={startTime}
                    onChange={setStartTime}
                    icon={Clock}
                  />
                </FieldLabel>
                <FieldLabel label="End time">
                  <TimeInput
                    value={endTime}
                    onChange={setEndTime}
                    icon={Clock}
                  />
                </FieldLabel>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Room optional">
                  <TextInput
                    value={room}
                    onChange={setRoom}
                    icon={MapPin}
                    placeholder="B204"
                  />
                </FieldLabel>
                <FieldLabel label="Teacher optional">
                  <TextInput
                    value={teacher}
                    onChange={setTeacher}
                    icon={UserRound}
                    placeholder="Dr. Novak"
                  />
                </FieldLabel>
              </div>

              {error && (
                <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-caption text-red-400">
                  {error}
                </p>
              )}

              <ModalActions
                submitLabel={pending ? "Saving..." : "Add Class"}
                submitDisabled={pending || !subject.trim()}
                onClose={onClose}
              />
            </form>
          </div>

          <div className="max-h-[88vh] overflow-y-auto border-t border-hairline bg-surface-2 p-4 lg:border-l lg:border-t-0">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-ink-tertiary" />
              <h3 className="text-body-sm font-medium text-ink">
                Saved Classes
              </h3>
            </div>
            {entries.length === 0 ? (
              <p className="rounded-md border border-dashed border-hairline p-4 text-center text-caption text-ink-subtle">
                No recurring classes yet.
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const subjectName = displaySubjectName(entry.subject);
                  const style = getSubjectStyle(subjectName);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-md border border-hairline bg-surface-1 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 rounded-full",
                            style.dot,
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body-sm font-medium text-ink">
                            {subjectName}
                          </p>
                          <p className="text-caption text-ink-tertiary">
                            {getWeekdayLabel(entry.weekday)} /{" "}
                            {timeRange(entry.start_time, entry.end_time)}
                          </p>
                          {(entry.room || entry.teacher) && (
                            <p className="truncate text-caption text-ink-tertiary">
                              {[entry.room, entry.teacher]
                                .filter(Boolean)
                                .join(" / ")}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-tertiary hover:bg-surface-3 hover:text-red-400"
                          aria-label="Delete class"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

function ModalHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-card-title text-ink">{title}</h3>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
        aria-label="Close modal"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption text-ink-subtle">{label}</span>
      {children}
    </label>
  );
}

function TimeInput({
  value,
  onChange,
  icon: Icon,
}: {
  value: string;
  onChange: (value: string) => void;
  icon: typeof Clock;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 py-2.5 pl-9 pr-3 text-body-sm text-ink focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
      />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  icon: Icon,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  icon: typeof MapPin;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[44px] w-full rounded-md border border-hairline bg-surface-2 py-2.5 pl-9 pr-3 text-body-sm text-ink placeholder:text-ink-tertiary focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
      />
    </div>
  );
}

function ModalActions({
  submitLabel,
  submitDisabled,
  onClose,
}: {
  submitLabel: string;
  submitDisabled: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="min-h-9 rounded-md px-4 py-2 text-button text-ink-subtle hover:bg-surface-2"
      >
        Cancel
      </button>
      <motion.button
        type="submit"
        disabled={submitDisabled}
        whileHover={{ scale: submitDisabled ? 1 : 1.02 }}
        whileTap={{ scale: submitDisabled ? 1 : 0.98 }}
        className="min-h-9 rounded-md bg-primary px-4 py-2 text-button text-on-primary hover:bg-primary-hover disabled:opacity-50"
      >
        {submitLabel}
      </motion.button>
    </div>
  );
}
