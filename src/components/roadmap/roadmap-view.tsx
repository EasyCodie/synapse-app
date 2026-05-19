"use client";

import { useMemo, useState, useTransition, type ElementType } from "react";
import {
  Check,
  EyeOff,
  Flag,
  Link2,
  Milestone,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ROADMAP_CATEGORIES,
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
  type RoadmapCategory,
  type RoadmapInsight,
  type RoadmapItem,
  type RoadmapPriority,
  type RoadmapStatus,
  type RoadmapSubject,
} from "@/lib/roadmap-types";

type RoadmapViewProps = {
  initialItems: RoadmapItem[];
  initialInsight: RoadmapInsight | null;
  subjects: RoadmapSubject[];
};

type Filter = "all" | RoadmapCategory;

type Draft = {
  title: string;
  description: string;
  start_date: string;
  due_date: string;
  status: RoadmapStatus;
  priority: RoadmapPriority;
  notes: string;
};

const CATEGORY_LABELS: Record<RoadmapCategory, string> = {
  exam: "Finals",
  mock_exam: "Mocks",
  ia: "IAs",
  ee: "EE",
  tok: "TOK",
  cas: "CAS",
  revision: "Revision",
  custom: "Custom",
};

const CATEGORY_STYLES: Record<RoadmapCategory, string> = {
  exam: "border-primary/40 bg-primary/10 text-primary",
  mock_exam: "border-primary/30 bg-primary/5 text-primary",
  ia: "border-hairline bg-surface-2 text-ink-subtle",
  ee: "border-hairline bg-surface-2 text-ink-subtle",
  tok: "border-hairline bg-surface-2 text-ink-subtle",
  cas: "border-hairline bg-surface-2 text-ink-subtle",
  revision: "border-hairline bg-surface-2 text-ink-subtle",
  custom: "border-hairline bg-surface-2 text-ink-subtle",
};

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  done: "Done",
  deferred: "Deferred",
};

const PRIORITY_LABELS: Record<RoadmapPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function RoadmapView({
  initialItems,
  initialInsight,
  subjects,
}: RoadmapViewProps) {
  const [items, setItems] = useState(initialItems);
  const [insight, setInsight] = useState(initialInsight);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialItems[0]?.id ?? null
  );
  const [draft, setDraft] = useState<Draft>(() =>
    createDraft(initialItems[0] ?? null)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);
  const [isPending, startTransition] = useTransition();

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const openItems = useMemo(
    () => items.filter((item) => item.status !== "done"),
    [items]
  );
  const activeItems = openItems.filter((item) => item.status === "active");
  const nextItems = [...openItems].sort(compareItems).slice(0, 5);
  const filteredItems = items
    .filter((item) => filter === "all" || item.category === filter)
    .sort(compareItems);
  const groupedItems = groupByMonth(filteredItems);

  function refreshRoadmap() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/roadmap/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai: true }),
        });
        const body = (await response.json()) as {
          items?: RoadmapItem[];
          insight?: RoadmapInsight | null;
          ai?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "Refresh failed");
        const nextItems = body.items ?? [];
        const nextSelected =
          nextItems.find((item) => item.id === selectedId) ?? nextItems[0] ?? null;
        setItems(nextItems);
        setInsight(body.insight ?? null);
        setSelectedId(nextSelected?.id ?? null);
        setDraft(createDraft(nextSelected));
        setMessage(body.ai ? "Focus plan refreshed" : "Roadmap refreshed");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Refresh failed");
      }
    });
  }

  function patchItem(id: string, updates: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/roadmap/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        });
        const body = (await response.json()) as {
          item?: RoadmapItem;
          error?: string;
        };
        if (!response.ok || !body.item) {
          throw new Error(body.error ?? "Update failed");
        }

        const nextItems = body.item.hidden
          ? items.filter((item) => item.id !== body.item!.id)
          : items.map((item) => (item.id === body.item!.id ? body.item! : item));
        const nextSelected =
          body.item.hidden && selectedId === body.item.id
            ? nextItems[0] ?? null
            : body.item.id === selectedId
              ? body.item
              : selected;

        setItems(nextItems);
        setSelectedId(nextSelected?.id ?? null);
        setDraft(createDraft(nextSelected));
        setMessage("Roadmap item updated");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Update failed");
      }
    });
  }

  function linkItem(id: string, kind: "task" | "milestone") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/roadmap/items/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, kind }),
        });
        const body = (await response.json()) as {
          item?: RoadmapItem;
          error?: string;
        };
        if (!response.ok || !body.item) {
          throw new Error(body.error ?? "Link failed");
        }
        setItems((current) =>
          current.map((item) => (item.id === body.item!.id ? body.item! : item))
        );
        if (body.item.id === selectedId) setDraft(createDraft(body.item));
        setMessage(kind === "task" ? "Task created" : "Milestone pinned");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Link failed");
      }
    });
  }

  function saveSelected() {
    if (!selected) return;
    patchItem(selected.id, {
      title: draft.title,
      description: draft.description,
      start_date: draft.start_date || null,
      due_date: draft.due_date || null,
      status: draft.status,
      priority: draft.priority,
      notes: draft.notes,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-headline text-ink">Roadmap</h1>
          <p className="mt-1 text-body-sm text-ink-subtle">
            {openItems.length} open checkpoints across IB coursework and exams
          </p>
        </div>
        <button
          type="button"
          onClick={refreshRoadmap}
          disabled={isPending}
          className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-button text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Focus Plan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCell label="Now" value={activeItems.length} detail="active" />
        <SummaryCell
          label="Next"
          value={nextItems[0]?.title ?? "No open item"}
          detail={nextItems[0]?.due_date ? formatDate(nextItems[0].due_date) : ""}
        />
        <SummaryCell
          label="Later"
          value={Math.max(openItems.length - nextItems.length, 0)}
          detail="queued"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all", ...ROADMAP_CATEGORIES] as Filter[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-caption transition-colors",
                  filter === category
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-hairline bg-surface-1 text-ink-subtle hover:border-hairline-strong hover:text-ink"
                )}
              >
                {category === "all" ? "All" : CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-hairline bg-surface-1">
            {groupedItems.length === 0 ? (
              <div className="p-6 text-body-sm text-ink-subtle">
                No visible roadmap items match this filter.
              </div>
            ) : (
              groupedItems.map((group) => (
                <div key={group.key} className="border-b border-hairline last:border-b-0">
                  <div className="flex items-center justify-between px-4 py-3">
                    <h2 className="text-cell font-medium text-ink">{group.label}</h2>
                    <span className="text-caption text-ink-tertiary">
                      {group.items.length}
                    </span>
                  </div>
                  <div className="divide-y divide-hairline/50">
                    {group.items.map((item) => {
                      const subject = item.subject_id
                        ? subjectById.get(item.subject_id)
                        : null;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedId(item.id);
                            setDraft(createDraft(item));
                          }}
                          className={cn(
                            "grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/60 md:grid-cols-[118px_minmax(0,1fr)_120px]",
                            selectedId === item.id && "bg-surface-2/70"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-sm border px-1.5 py-0.5 text-caption",
                                CATEGORY_STYLES[item.category]
                              )}
                            >
                              {CATEGORY_LABELS[item.category]}
                            </span>
                            <PriorityDot priority={item.priority} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-body-sm text-ink">
                              {item.title}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-caption text-ink-tertiary">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2 md:justify-end">
                            {subject ? (
                              <span className="truncate rounded-sm bg-surface-3 px-1.5 py-0.5 text-caption text-ink-tertiary">
                                {subject.subject_name}
                              </span>
                            ) : null}
                            <span className="shrink-0 text-caption tabular-nums text-ink-subtle">
                              {item.due_date ? formatDate(item.due_date) : "No date"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-hairline bg-surface-1 p-5">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              <h2 className="text-card-title text-ink">Focus</h2>
            </div>
            {insight ? (
              <div className="mt-3 space-y-3">
                <p className="text-body-sm text-ink-subtle">{insight.summary}</p>
                <div className="space-y-2">
                  {(insight.next_actions ?? []).map((action) => (
                    <div key={action} className="flex gap-2 text-body-sm text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
                {insight.risk_flags.length > 0 ? (
                  <div className="space-y-1 rounded-md border border-hairline bg-surface-2 p-3">
                    {insight.risk_flags.map((risk) => (
                      <p key={risk} className="text-caption text-ink-subtle">
                        {risk}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-body-sm text-ink-subtle">
                Refresh Roadmap to generate focus guidance.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-hairline bg-surface-1 p-5">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              <h2 className="text-card-title text-ink">Selected Item</h2>
            </div>
            {selected ? (
              <div className="mt-4 space-y-3">
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-body-sm text-ink outline-none transition-colors focus:border-hairline-strong"
                />
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-body-sm text-ink outline-none transition-colors focus:border-hairline-strong"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-caption text-ink-tertiary">Start</span>
                    <input
                      type="date"
                      value={draft.start_date}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          start_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-caption text-ink outline-none focus:border-hairline-strong"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-caption text-ink-tertiary">Due</span>
                    <input
                      type="date"
                      value={draft.due_date}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          due_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-caption text-ink outline-none focus:border-hairline-strong"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        status: event.target.value as RoadmapStatus,
                      }))
                    }
                    className="rounded-md border border-hairline bg-surface-2 px-3 py-2 text-caption text-ink outline-none focus:border-hairline-strong"
                  >
                    {ROADMAP_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        priority: event.target.value as RoadmapPriority,
                      }))
                    }
                    className="rounded-md border border-hairline bg-surface-2 px-3 py-2 text-caption text-ink outline-none focus:border-hairline-strong"
                  >
                    {ROADMAP_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  rows={3}
                  placeholder="Private notes"
                  className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-body-sm text-ink outline-none transition-colors placeholder:text-ink-tertiary focus:border-hairline-strong"
                />
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label="Save"
                    icon={Save}
                    disabled={isPending}
                    onClick={saveSelected}
                  />
                  <ActionButton
                    label="Mark Done"
                    icon={Check}
                    disabled={isPending}
                    onClick={() => patchItem(selected.id, { status: "done" })}
                  />
                  <ActionButton
                    label="More"
                    icon={MoreHorizontal}
                    disabled={isPending}
                    onClick={() => setShowSecondaryActions((current) => !current)}
                  />
                </div>
                {showSecondaryActions && (
                  <div className="flex flex-wrap gap-2 rounded-md border border-hairline bg-surface-2/70 p-2">
                    <ActionButton
                      label="Create Task"
                      icon={Link2}
                      disabled={isPending || Boolean(selected.linked_task_id)}
                      onClick={() => linkItem(selected.id, "task")}
                    />
                    <ActionButton
                      label="Pin Milestone"
                      icon={Milestone}
                      disabled={isPending || Boolean(selected.linked_milestone_id)}
                      onClick={() => linkItem(selected.id, "milestone")}
                    />
                    <ActionButton
                      label="Hide"
                      icon={EyeOff}
                      disabled={isPending}
                      onClick={() => patchItem(selected.id, { hidden: true })}
                    />
                  </div>
                )}
                {(message || error) && (
                  <p
                    className={cn(
                      "rounded-md border px-3 py-2 text-caption",
                      error
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-primary/25 bg-primary/10 text-ink"
                    )}
                  >
                    {error ?? message}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-body-sm text-ink-subtle">
                Select a roadmap item to edit it.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 px-4 py-3">
      <p className="text-caption text-ink-tertiary">{label}</p>
      <p className="mt-1 truncate text-body-sm font-medium text-ink">{value}</p>
      {detail ? <p className="mt-0.5 text-caption text-ink-tertiary">{detail}</p> : null}
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: ElementType;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-caption text-ink-subtle transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-50"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function PriorityDot({ priority }: { priority: RoadmapPriority }) {
  const className: Record<RoadmapPriority, string> = {
    low: "bg-ink-tertiary",
    medium: "bg-ink-subtle",
    high: "bg-primary",
    urgent: "bg-destructive",
  };
  return (
    <span className="inline-flex items-center" title={PRIORITY_LABELS[priority]}>
      <Flag className={cn("h-3.5 w-3.5", className[priority].replace("bg-", "text-"))} />
    </span>
  );
}

function createDraft(item: RoadmapItem | null): Draft {
  return {
    title: item?.title ?? "",
    description: item?.description ?? "",
    start_date: item?.start_date ?? "",
    due_date: item?.due_date ?? "",
    status: item?.status ?? "upcoming",
    priority: item?.priority ?? "medium",
    notes: item?.notes ?? "",
  };
}

function groupByMonth(items: RoadmapItem[]) {
  const map = new Map<string, { key: string; label: string; items: RoadmapItem[] }>();
  for (const item of items) {
    const key = item.due_date?.slice(0, 7) ?? "undated";
    const label = item.due_date ? formatMonth(item.due_date) : "No Date";
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key)!.items.push(item);
  }
  return Array.from(map.values());
}

function compareItems(a: RoadmapItem, b: RoadmapItem) {
  const leftDate = a.due_date ?? "9999-12-31";
  const rightDate = b.due_date ?? "9999-12-31";
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return priorityRank(b.priority) - priorityRank(a.priority);
}

function priorityRank(priority: RoadmapPriority) {
  const ranks: Record<RoadmapPriority, number> = {
    low: 0,
    medium: 1,
    high: 2,
    urgent: 3,
  };
  return ranks[priority];
}

function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(parseLocalDate(date));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(parseLocalDate(date));
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
