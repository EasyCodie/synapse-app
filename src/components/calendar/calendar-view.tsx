"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Check,
  Trash2,
  Calendar,
  Flag,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  completed: boolean;
  subject_id: string | null;
  created_at: string;
}

interface Milestone {
  id: string;
  title: string;
  date: string;
  type: "exam" | "ia_deadline" | "ee_deadline" | "tok_deadline" | "custom";
  subject_id: string | null;
}

interface CalendarViewProps {
  initialTasks: Task[];
  initialMilestones: Milestone[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getStartDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isSameDay(dateStr: string, year: number, month: number, day: number) {
  // Compare directly against the date string to avoid timezone shifts
  const target = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return dateStr.startsWith(target);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-ink-tertiary", dot: "bg-ink-tertiary" },
  medium: { label: "Medium", color: "bg-ink-subtle", dot: "bg-ink-subtle" },
  high: { label: "High", color: "bg-primary", dot: "bg-primary" },
  urgent: { label: "Urgent", color: "bg-red-500", dot: "bg-red-500" },
};

export function CalendarView({ initialTasks, initialMilestones }: CalendarViewProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [milestones] = useState<Milestone[]>(initialMilestones);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const startDay = getStartDayOfWeek(viewYear, viewMonth);
  const today = now.getDate();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const toggleTask = useCallback(async (id: string, completed: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed }),
    });
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
  }, []);

  const addTask = useCallback(async (title: string, dueDate: string, priority: string) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, due_date: dueDate, priority }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => [...prev, data.task]);
    }
    setShowAddTask(false);
  }, [setShowAddTask]);

  // Get tasks/milestones for a specific day
  const getItemsForDay = (day: number) => {
    const dayTasks = tasks.filter(
      (t) => t.due_date && !t.completed && isSameDay(t.due_date, viewYear, viewMonth, day)
    );
    const dayMilestones = milestones.filter(
      (m) => isSameDay(m.date, viewYear, viewMonth, day)
    );
    return { dayTasks, dayMilestones };
  };

  // Upcoming incomplete tasks (next 14 days)
  const upcoming = tasks
    .filter((t) => !t.completed && t.due_date)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .slice(0, 10);

  // Overdue tasks
  const todayKey = formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const overdue = tasks.filter(
    (t) => !t.completed && t.due_date && t.due_date < todayKey
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline text-ink">Calendar & Tasks</h1>
          <p className="text-body-sm text-ink-subtle mt-1">
            {tasks.filter((t) => !t.completed).length} open tasks
            {overdue.length > 0 && (
              <span className="ml-2 text-red-400">· {overdue.length} overdue</span>
            )}
          </p>
        </div>
        <button
          onClick={() => { if (!selectedDate) setSelectedDate(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate())); setShowAddTask(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-md text-button hover:bg-primary-hover transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-surface-1 border border-hairline rounded-lg p-6">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-card-title text-ink">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface-2 text-ink-subtle transition-colors duration-200 active:scale-95">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextMonth} className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-surface-2 text-ink-subtle transition-colors duration-200 active:scale-95">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-caption text-ink-tertiary py-1.5">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`e-${i}`} className="h-11" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const { dayTasks, dayMilestones } = getItemsForDay(day);
              const isToday = isCurrentMonth && day === today;
              const dateKey = formatDateKey(viewYear, viewMonth, day);
              const isSelected = selectedDate === dateKey;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  className={cn(
                    "h-11 flex flex-col items-center justify-center rounded-md relative transition-colors duration-200",
                    isToday && "bg-primary/10",
                    isSelected && "ring-1 ring-primary",
                    !isToday && !isSelected && "hover:bg-surface-2"
                  )}
                >
                  <span className={cn(
                    "text-caption",
                    isToday ? "text-primary font-semibold" : "text-ink-subtle"
                  )}>
                    {day}
                  </span>
                  {(dayTasks.length > 0 || dayMilestones.length > 0) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayTasks.length > 0 && <div className="w-1 h-1 rounded-full bg-primary" />}
                      {dayMilestones.length > 0 && <div className="w-1 h-1 rounded-full bg-semantic-success" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-3 border-t border-hairline">
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

        {/* Task list sidebar */}
        <div className="space-y-4">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="bg-surface-1 border border-red-500/20 rounded-lg p-6">
              <h3 className="text-body-sm font-medium text-red-400 mb-2">Overdue</h3>
              <div className="space-y-1.5">
                {overdue.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div className="bg-surface-1 border border-hairline rounded-lg p-6">
            <h3 className="text-body-sm font-medium text-ink mb-3">Upcoming</h3>
            {upcoming.length === 0 ? (
              <p className="text-caption text-ink-subtle py-4 text-center">
                No upcoming tasks. Click a date or &ldquo;Add Task&rdquo; to create one.
              </p>
            ) : (
              <div className="space-y-1">
                {upcoming.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </div>
            )}
          </div>

          {/* Milestones */}
          {milestones.length > 0 && (
            <div className="bg-surface-1 border border-hairline rounded-lg p-6">
              <h3 className="text-body-sm font-medium text-ink mb-3">Milestones</h3>
              <div className="space-y-2">
                {milestones.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-semantic-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-ink truncate">{m.title}</p>
                      <p className="text-caption text-ink-tertiary">
                        {new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="text-caption px-1.5 py-0.5 bg-surface-2 rounded text-ink-subtle shrink-0">
                      {m.type.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskModal
          defaultDate={selectedDate ?? formatDateKey(now.getFullYear(), now.getMonth(), now.getDate())}
          onAdd={addTask}
          onClose={() => setShowAddTask(false)}
        />
      )}
    </div>
  );
}

// ─── Task Row ────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const config = PRIORITY_CONFIG[task.priority];

  return (
    <div className="group flex items-center gap-2 py-1">
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-all duration-200",
          task.completed
            ? "bg-primary/10"
            : "hover:bg-surface-2"
        )}
      >
        <div className={cn(
          "w-4 h-4 rounded border flex items-center justify-center transition-colors duration-200",
          task.completed
            ? "bg-primary border-primary"
            : "border-hairline-strong hover:border-primary"
        )}>
          {task.completed && <Check className="w-3 h-3 text-on-primary" />}
        </div>
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-body-sm truncate",
          task.completed ? "text-ink-tertiary line-through" : "text-ink"
        )}>
          {task.title}
        </p>
      </div>
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      {task.due_date && (
        <span className="text-caption text-ink-tertiary shrink-0">
          {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      )}
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-md text-ink-tertiary hover:text-red-400 hover:bg-surface-2 transition-all duration-200"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Add Task Modal ──────────────────────────────────────────────────────────

function AddTaskModal({
  defaultDate,
  onAdd,
  onClose,
}: {
  defaultDate: string;
  onAdd: (title: string, dueDate: string, priority: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [priority, setPriority] = useState("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), dueDate, priority);
    setTitle("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface-1 border border-hairline rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-card-title text-ink">New Task</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-2 text-ink-subtle">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-caption text-ink-subtle mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Finish Chemistry IA draft"
              className="w-full px-3 py-2 rounded-md bg-surface-2 border border-hairline text-body-sm text-ink placeholder:text-ink-tertiary focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
              autoFocus
            />
          </div>

          {/* Due date */}
          <div>
            <label className="text-caption text-ink-subtle mb-1 block">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-md bg-surface-2 border border-hairline text-body-sm text-ink focus:border-hairline-strong focus:outline-2 focus:outline-primary/50"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-caption text-ink-subtle mb-1.5 block">Priority</label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption border transition-colors duration-200",
                    priority === p
                      ? "border-primary bg-primary/10 text-ink"
                      : "border-hairline text-ink-subtle hover:border-hairline-strong"
                  )}
                >
                  <Flag className={cn("w-3 h-3", PRIORITY_CONFIG[p].color.replace("bg-", "text-"))} />
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-button text-ink-subtle hover:bg-surface-2 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 rounded-md bg-primary text-on-primary text-button hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
