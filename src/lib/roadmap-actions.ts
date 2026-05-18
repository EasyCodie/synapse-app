import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { createClient } from "@/lib/local/client";
import {
  compareRoadmapItems,
  ensureRoadmapForUser,
  generateAndMergeRoadmap,
  getTodayKey,
  loadRoadmapData,
  saveRoadmapInsight,
} from "@/lib/roadmap";
import {
  clearRoadmapInsightCache,
  generateRoadmapInsight,
} from "@/lib/roadmap-ai";
import {
  ROADMAP_CATEGORIES,
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
  type RoadmapCategory,
  type RoadmapItem,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@/lib/roadmap-types";

type LocalClient = Awaited<ReturnType<typeof createClient>>;
type LinkKind = "task" | "milestone";

type DateInputResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export class RoadmapActionError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
    this.name = "RoadmapActionError";
  }
}

export type RoadmapFindArgs = {
  query?: string;
  category?: RoadmapCategory;
  status?: RoadmapStatus;
  subject_id?: string;
  from?: string;
  to?: string;
  priority?: RoadmapPriority;
  include_hidden?: boolean;
  hidden?: boolean;
  limit?: number;
};

export type RoadmapCreateArgs = {
  title?: string;
  description?: string | null;
  category?: RoadmapCategory;
  status?: RoadmapStatus;
  priority?: RoadmapPriority;
  start_date?: string | null;
  due_date?: string | null;
  subject_id?: string | null;
  notes?: string | null;
};

export type RoadmapUpdateArgs = {
  id?: string;
  title?: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  status?: RoadmapStatus;
  priority?: RoadmapPriority;
  notes?: string | null;
  hidden?: boolean;
};

export type RoadmapSplitArgs = {
  id?: string;
  checkpoints?: RoadmapCreateArgs[];
};

export type RoadmapOverview = {
  insight: Awaited<ReturnType<typeof loadRoadmapData>>["insight"];
  counts: {
    total: number;
    visible: number;
    hidden: number;
    open: number;
    by_status: Record<RoadmapStatus, number>;
    by_category: Record<RoadmapCategory, number>;
  };
  next_focus: RoadmapItem[];
  risks: string[];
  timeline: RoadmapItem[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_SET = new Set<string>(ROADMAP_STATUSES);
const PRIORITY_SET = new Set<string>(ROADMAP_PRIORITIES);
const CATEGORY_SET = new Set<string>(ROADMAP_CATEGORIES);
const MAX_FIND_LIMIT = 50;
const MAX_SPLIT_CHECKPOINTS = 12;
const MILESTONE_TYPES: Partial<Record<RoadmapCategory, string>> = {
  exam: "exam",
  mock_exam: "exam",
  ia: "ia_deadline",
  ee: "ee_deadline",
  tok: "tok_deadline",
};

export async function getRoadmapOverview(
  userId: string,
  args: Pick<RoadmapFindArgs, "include_hidden" | "limit" | "from" | "to"> = {},
  localClient?: LocalClient
): Promise<RoadmapOverview> {
  const local = localClient ?? (await createClient());
  validateFindArgs({ from: args.from, to: args.to });
  await ensureRoadmapForUser(userId, { localClient: local });
  const { items, insight } = await loadRoadmapData(userId, {
    includeHidden: true,
    localClient: local,
  });

  const visible = items.filter((item) => args.include_hidden || !item.hidden);
  const datedVisible = applyDateWindow(visible, args.from, args.to);
  const openItems = datedVisible
    .filter((item) => item.status !== "done")
    .sort(compareRoadmapItems);
  const limit = clampLimit(args.limit, 12);

  return {
    insight,
    counts: {
      total: items.length,
      visible: items.filter((item) => !item.hidden).length,
      hidden: items.filter((item) => item.hidden).length,
      open: items.filter((item) => !item.hidden && item.status !== "done").length,
      by_status: countBy(visible, ROADMAP_STATUSES, "status"),
      by_category: countBy(visible, ROADMAP_CATEGORIES, "category"),
    },
    next_focus: openItems.slice(0, 5),
    risks: buildRoadmapRisks(openItems, insight?.risk_flags ?? []),
    timeline: datedVisible.sort(compareRoadmapItems).slice(0, limit),
  };
}

export async function findRoadmapItems(
  userId: string,
  args: RoadmapFindArgs = {},
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  validateFindArgs(args);
  const { items } = await loadRoadmapData(userId, {
    includeHidden: true,
    localClient: local,
  });

  const needle = args.query?.trim().toLowerCase();
  const limit = clampLimit(args.limit, 20);
  const filtered = items
    .filter((item) => {
      if (!args.include_hidden && args.hidden !== true && item.hidden) return false;
      if (typeof args.hidden === "boolean" && item.hidden !== args.hidden) return false;
      if (args.category && item.category !== args.category) return false;
      if (args.status && item.status !== args.status) return false;
      if (args.priority && item.priority !== args.priority) return false;
      if (args.subject_id && item.subject_id !== args.subject_id) return false;
      if (needle && !matchesText(item, needle)) return false;
      return true;
    });

  return applyDateWindow(filtered, args.from, args.to)
    .sort(compareRoadmapItems)
    .slice(0, limit);
}

export async function createRoadmapItem(
  userId: string,
  args: RoadmapCreateArgs,
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  const title = normalizeRequiredTitle(args.title);
  const category = normalizeCategory(args.category ?? "custom");
  const status = normalizeStatus(args.status ?? "upcoming");
  const priority = normalizePriority(args.priority ?? "medium");
  const startDate = normalizeDateInput(args.start_date, "start_date");
  const dueDate = normalizeDateInput(args.due_date, "due_date");
  if (!startDate.ok) throw new RoadmapActionError(startDate.error);
  if (!dueDate.ok) throw new RoadmapActionError(dueDate.error);

  const { data, error } = await local
    .from("roadmap_items")
    .insert({
      user_id: userId,
      title,
      description: normalizeNullableText(args.description),
      category,
      status,
      priority,
      start_date: startDate.value,
      due_date: dueDate.value,
      subject_id: normalizeNullableText(args.subject_id),
      source_type: "custom",
      source_id: null,
      parent_id: null,
      generated_key: null,
      manual_override: true,
      hidden: false,
      notes: normalizeNullableText(args.notes),
      linked_task_id: null,
      linked_milestone_id: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new RoadmapActionError(error?.message ?? "Failed to create roadmap item", 500);
  }

  clearRoadmapInsightCache();
  return data as RoadmapItem;
}

export async function updateRoadmapItem(
  userId: string,
  args: RoadmapUpdateArgs,
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  const id = normalizeId(args.id, "id");
  await loadRoadmapItem(userId, id, local);

  const updates: Record<string, unknown> = {
    manual_override: true,
    updated_at: new Date().toISOString(),
  };

  if ("title" in args) updates.title = normalizeRequiredTitle(args.title);
  if ("description" in args) {
    updates.description = normalizeNullableText(args.description);
  }
  if ("notes" in args) updates.notes = normalizeNullableText(args.notes);
  if ("hidden" in args) {
    if (typeof args.hidden !== "boolean") {
      throw new RoadmapActionError("hidden must be a boolean");
    }
    updates.hidden = args.hidden;
  }
  if ("status" in args) updates.status = normalizeStatus(args.status);
  if ("priority" in args) updates.priority = normalizePriority(args.priority);
  if ("start_date" in args) {
    const date = normalizeDateInput(args.start_date, "start_date");
    if (!date.ok) throw new RoadmapActionError(date.error);
    updates.start_date = date.value;
  }
  if ("due_date" in args) {
    const date = normalizeDateInput(args.due_date, "due_date");
    if (!date.ok) throw new RoadmapActionError(date.error);
    updates.due_date = date.value;
  }

  if (Object.keys(updates).length <= 2) {
    throw new RoadmapActionError("No roadmap item fields provided to update");
  }

  const { data, error } = await local
    .from("roadmap_items")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new RoadmapActionError(error?.message ?? "Failed to update roadmap item", 500);
  }

  clearRoadmapInsightCache();
  return data as RoadmapItem;
}

export async function splitRoadmapItem(
  userId: string,
  args: RoadmapSplitArgs,
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  const id = normalizeId(args.id, "id");
  const parent = await loadRoadmapItem(userId, id, local);
  const checkpoints = Array.isArray(args.checkpoints) ? args.checkpoints : [];

  if (checkpoints.length === 0) {
    throw new RoadmapActionError("At least one checkpoint is required");
  }
  if (checkpoints.length > MAX_SPLIT_CHECKPOINTS) {
    throw new RoadmapActionError(
      `Split accepts at most ${MAX_SPLIT_CHECKPOINTS} checkpoints`
    );
  }

  const rows = checkpoints.map((checkpoint) => {
    const startDate = normalizeDateInput(checkpoint.start_date, "start_date");
    const dueDate = normalizeDateInput(checkpoint.due_date, "due_date");
    if (!startDate.ok) throw new RoadmapActionError(startDate.error);
    if (!dueDate.ok) throw new RoadmapActionError(dueDate.error);

    return {
      user_id: userId,
      title: normalizeRequiredTitle(checkpoint.title),
      description: normalizeNullableText(checkpoint.description),
      category: normalizeCategory(checkpoint.category ?? parent.category),
      status: normalizeStatus(checkpoint.status ?? "upcoming"),
      priority: normalizePriority(checkpoint.priority ?? parent.priority),
      start_date: startDate.value,
      due_date: dueDate.value,
      subject_id: normalizeNullableText(checkpoint.subject_id) ?? parent.subject_id,
      source_type: "custom",
      source_id: parent.id,
      parent_id: parent.id,
      generated_key: null,
      manual_override: true,
      hidden: false,
      notes: normalizeNullableText(checkpoint.notes),
      linked_task_id: null,
      linked_milestone_id: null,
    };
  });

  const { data, error } = await local.from("roadmap_items").insert(rows).select("*");
  if (error || !data) {
    throw new RoadmapActionError(error?.message ?? "Failed to split roadmap item", 500);
  }

  clearRoadmapInsightCache();
  return data as RoadmapItem[];
}

export async function linkRoadmapItem(
  userId: string,
  args: { id?: string; kind?: LinkKind | string | null },
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  const id = normalizeId(args.id, "id");
  const kind = normalizeLinkKind(args.kind);
  const item = await loadRoadmapItem(userId, id, local);

  if (kind === "task") {
    return linkTask(userId, item, local);
  }
  return linkMilestone(userId, item, local);
}

export async function regenerateRoadmap(
  userId: string,
  args: { use_ai?: boolean } = {},
  localClient?: LocalClient
) {
  const local = localClient ?? (await createClient());
  clearRoadmapInsightCache();
  await ensureCurriculumScaffold(userId);
  const { context, items } = await generateAndMergeRoadmap(userId, {
    localClient: local,
  });
  const insight = await generateRoadmapInsight(context, items, {
    useAi: args.use_ai !== false,
  });
  await saveRoadmapInsight(userId, insight, local);
  const data = await loadRoadmapData(userId, { localClient: local });

  return {
    ...data,
    generated: true,
    ai: insight.model !== "deterministic",
  };
}

export function toRoadmapRouteError(error: unknown) {
  if (error instanceof RoadmapActionError) {
    return { message: error.message, status: error.status };
  }
  return { message: "Roadmap operation failed", status: 500 };
}

async function loadRoadmapItem(
  userId: string,
  id: string,
  local: LocalClient
) {
  const { data, error } = await local
    .from("roadmap_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new RoadmapActionError("Roadmap item not found", 404);
  }

  return data as RoadmapItem;
}

async function linkTask(userId: string, item: RoadmapItem, local: LocalClient) {
  if (item.linked_task_id) {
    return {
      item,
      linked_id: item.linked_task_id,
      kind: "task" as const,
      reused: true,
    };
  }

  const { data: task, error: taskError } = await local
    .from("tasks")
    .insert({
      user_id: userId,
      title: item.title,
      description: item.description,
      due_date: item.due_date,
      due_time: null,
      priority: item.priority,
      subject_id: item.subject_id,
      completed: item.status === "done",
    })
    .select("*")
    .single();

  if (taskError || !task) {
    throw new RoadmapActionError("Failed to create linked task", 500);
  }

  const { data: updatedItem, error: updateError } = await local
    .from("roadmap_items")
    .update({
      linked_task_id: task.id,
      manual_override: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError || !updatedItem) {
    throw new RoadmapActionError("Failed to update linked roadmap item", 500);
  }

  clearRoadmapInsightCache();
  return {
    item: updatedItem as RoadmapItem,
    linked: task,
    linked_id: task.id,
    kind: "task" as const,
    reused: false,
  };
}

async function linkMilestone(
  userId: string,
  item: RoadmapItem,
  local: LocalClient
) {
  if (item.linked_milestone_id) {
    return {
      item,
      linked_id: item.linked_milestone_id,
      kind: "milestone" as const,
      reused: true,
    };
  }

  const milestoneDate = item.due_date ?? item.start_date;
  if (!milestoneDate) {
    throw new RoadmapActionError(
      "Roadmap item needs a date before it can be pinned"
    );
  }

  const { data: milestone, error: milestoneError } = await local
    .from("milestones")
    .insert({
      user_id: userId,
      title: item.title,
      date: milestoneDate,
      type: MILESTONE_TYPES[item.category] ?? "custom",
      subject_id: item.subject_id,
    })
    .select("*")
    .single();

  if (milestoneError || !milestone) {
    throw new RoadmapActionError("Failed to create linked milestone", 500);
  }

  const { data: updatedItem, error: updateError } = await local
    .from("roadmap_items")
    .update({
      linked_milestone_id: milestone.id,
      manual_override: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updateError || !updatedItem) {
    throw new RoadmapActionError("Failed to update linked roadmap item", 500);
  }

  clearRoadmapInsightCache();
  return {
    item: updatedItem as RoadmapItem,
    linked: milestone,
    linked_id: milestone.id,
    kind: "milestone" as const,
    reused: false,
  };
}

function validateFindArgs(args: RoadmapFindArgs) {
  if (args.category) normalizeCategory(args.category);
  if (args.status) normalizeStatus(args.status);
  if (args.priority) normalizePriority(args.priority);

  const from = normalizeDateInput(args.from, "from");
  const to = normalizeDateInput(args.to, "to");
  if (!from.ok) throw new RoadmapActionError(from.error);
  if (!to.ok) throw new RoadmapActionError(to.error);
  if (from.value && to.value && from.value > to.value) {
    throw new RoadmapActionError("from must be before or equal to to");
  }
}

function applyDateWindow(
  items: RoadmapItem[],
  from?: string | null,
  to?: string | null
) {
  const fromDate = from || null;
  const toDate = to || null;
  if (!fromDate && !toDate) return items;

  return items.filter((item) => {
    const itemDate = item.due_date ?? item.start_date;
    if (!itemDate) return false;
    if (fromDate && itemDate < fromDate) return false;
    if (toDate && itemDate > toDate) return false;
    return true;
  });
}

function matchesText(item: RoadmapItem, needle: string) {
  return [item.title, item.description, item.notes]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

function buildRoadmapRisks(items: RoadmapItem[], insightRisks: string[]) {
  const today = getTodayKey();
  const overdue = items
    .filter(
      (item) =>
        item.due_date &&
        item.due_date < today &&
        (item.priority === "high" || item.priority === "urgent")
    )
    .slice(0, 3)
    .map((item) => `${item.title} is overdue.`);

  return Array.from(new Set([...insightRisks, ...overdue])).slice(0, 5);
}

function countBy<
  T extends readonly string[],
  K extends T[number],
  Field extends "status" | "category",
>(items: RoadmapItem[], keys: T, field: Field) {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const item of items) {
    const key = item[field] as unknown as K;
    counts[key] += 1;
  }
  return counts;
}

function normalizeId(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RoadmapActionError(`${field} is required`);
  }
  return value.trim();
}

function normalizeRequiredTitle(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RoadmapActionError("title is required");
  }
  return value.trim().slice(0, 180);
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function normalizeDateInput(value: unknown, field: string): DateInputResult {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value === "string" && DATE_RE.test(value)) {
    return { ok: true, value };
  }
  return { ok: false, error: `${field} must be YYYY-MM-DD` };
}

function normalizeStatus(value: unknown): RoadmapStatus {
  if (typeof value === "string" && STATUS_SET.has(value)) {
    return value as RoadmapStatus;
  }
  throw new RoadmapActionError("status must be upcoming, active, done, or deferred");
}

function normalizePriority(value: unknown): RoadmapPriority {
  if (typeof value === "string" && PRIORITY_SET.has(value)) {
    return value as RoadmapPriority;
  }
  throw new RoadmapActionError("priority must be low, medium, high, or urgent");
}

function normalizeCategory(value: unknown): RoadmapCategory {
  if (typeof value === "string" && CATEGORY_SET.has(value)) {
    return value as RoadmapCategory;
  }
  throw new RoadmapActionError("category is not a valid roadmap category");
}

function normalizeLinkKind(value: unknown): LinkKind {
  if (value === "task" || value === "milestone") return value;
  throw new RoadmapActionError("kind must be task or milestone");
}

function clampLimit(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), 1), MAX_FIND_LIMIT);
}
