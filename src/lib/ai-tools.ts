import { generateEmbedding } from "@/lib/embeddings";
import type { createClient } from "@/lib/local/client";
import {
  createRoadmapItem as createRoadmapItemAction,
  findRoadmapItems as findRoadmapItemsAction,
  getRoadmapOverview as getRoadmapOverviewAction,
  linkRoadmapItem as linkRoadmapItemAction,
  regenerateRoadmap as regenerateRoadmapAction,
  splitRoadmapItem as splitRoadmapItemAction,
  toRoadmapRouteError,
  updateRoadmapItem as updateRoadmapItemAction,
  type RoadmapCreateArgs,
  type RoadmapFindArgs,
  type RoadmapSplitArgs,
  type RoadmapUpdateArgs,
} from "@/lib/roadmap-actions";
import type { RoadmapItem } from "@/lib/roadmap-types";

type LocalClient = Awaited<ReturnType<typeof createClient>>;

/**
 * AI Tool Implementations
 *
 * Each tool function receives the local client + user ID + parsed arguments,
 * and returns a string result that goes back to the model as tool output.
 */

// ─── Tool: Search Resources ────────────────────────────────────────────────────

interface SearchResourcesArgs {
  query: string;
  limit?: number;
}

export async function searchResources(
  local: LocalClient,
  userId: string,
  args: SearchResourcesArgs,
): Promise<string> {
  const { query, limit = 6 } = args;

  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data: results, error } = await local.rpc("search_embeddings", {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: 0.4,
      match_count: limit,
    });

    if (error) {
      return `Search failed: ${error.message}`;
    }

    if (!results || results.length === 0) {
      return "No relevant resources found. The student may need to upload materials on this topic.";
    }

    const formatted = results.map(
      (
        r: {
          metadata: {
            title?: string;
            chunk_index?: number;
            word_start?: number;
            word_end?: number;
            heading?: string;
            page_label?: string;
            slide_label?: string;
          };
          source_type: string;
          source_id: string;
          chunk_index?: number | null;
          content_text: string;
          similarity: number;
        },
        i: number,
      ) => {
        const title = r.metadata?.title ?? r.source_type;
        const sourceDetails = formatSearchSourceDetails(r);
        return `[Source ${i + 1}] "${title}" (${sourceDetails})\n${r.content_text}`;
      },
    );

    return formatted.join("\n\n---\n\n");
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

// ─── Tool: Create Flashcards ───────────────────────────────────────────────────

function formatSearchSourceDetails(result: {
  metadata?: {
    chunk_index?: number;
    word_start?: number;
    word_end?: number;
    heading?: string;
    page_label?: string;
    slide_label?: string;
  };
  source_type: string;
  source_id: string;
  chunk_index?: number | null;
  similarity: number;
}) {
  const metadata = result.metadata ?? {};
  const chunkIndex =
    typeof metadata.chunk_index === "number"
      ? metadata.chunk_index
      : result.chunk_index;
  const parts = [
    `${(result.similarity * 100).toFixed(0)}% match`,
    `id: ${result.source_id}`,
    `type: ${result.source_type}`,
  ];

  if (typeof chunkIndex === "number") parts.push(`chunk: ${chunkIndex}`);
  if (
    typeof metadata.word_start === "number" &&
    typeof metadata.word_end === "number"
  ) {
    parts.push(`words: ${metadata.word_start + 1}-${metadata.word_end + 1}`);
  }
  if (metadata.heading) parts.push(`heading: ${formatSourceLabel(metadata.heading)}`);
  if (metadata.page_label) parts.push(`page: ${formatSourceLabel(metadata.page_label)}`);
  if (metadata.slide_label) parts.push(`slide: ${formatSourceLabel(metadata.slide_label)}`);

  return parts.join(", ");
}

function formatSourceLabel(value: string) {
  return value.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

interface CreateFlashcardsArgs {
  flashcards: Array<{ front: string; back: string; tags?: string[] }>;
  subject_id?: string;
}

export async function createFlashcards(
  local: LocalClient,
  userId: string,
  args: CreateFlashcardsArgs,
): Promise<string> {
  const { flashcards, subject_id } = args;

  if (!flashcards || flashcards.length === 0) {
    return "No flashcards provided to create.";
  }

  const rows = flashcards.map((fc) => ({
    user_id: userId,
    subject_id: subject_id || null,
    front: fc.front,
    back: fc.back,
    tags: fc.tags || [],
    confidence: 0,
    next_review: new Date().toISOString(),
  }));

  const { data, error } = await local
    .from("flashcards")
    .insert(rows)
    .select("id");

  if (error) {
    return `Failed to create flashcards: ${error.message}`;
  }

  return `Successfully created ${data.length} flashcard${data.length > 1 ? "s" : ""}. They are ready for review.`;
}

// ─── Tool: Create Task ─────────────────────────────────────────────────────────

interface CreateTaskArgs {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  subject_id?: string;
  source_title?: string;
  source_url?: string;
}

export async function createTask(
  local: LocalClient,
  userId: string,
  args: CreateTaskArgs,
): Promise<string> {
  const {
    title,
    description,
    due_date,
    due_time,
    priority = "medium",
    subject_id,
    source_title,
    source_url,
  } = args;

  const { data, error } = await local
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      description: description || null,
      due_date: due_date || null,
      due_time: due_time || null,
      priority,
      subject_id: subject_id || null,
      source_title: source_title || null,
      source_url: source_url || null,
      completed: false,
    })
    .select("id, title, due_date, due_time, priority, source_title")
    .single();

  if (error) {
    return `Failed to create task: ${error.message}`;
  }

  let result = `Task created: "${data.title}" (${data.priority} priority)`;
  if (data.due_date) {
    result += ` — due ${data.due_date}`;
  }
  if (data.due_time) {
    result += ` at ${data.due_time}`;
  }
  if (data.source_title) {
    result += ` - source: ${data.source_title}`;
  }
  return result;
}

// ─── Tool: Get Upcoming Deadlines ──────────────────────────────────────────────

interface GetUpcomingDeadlinesArgs {
  days_ahead?: number;
}

export async function getUpcomingDeadlines(
  local: LocalClient,
  userId: string,
  args: GetUpcomingDeadlinesArgs,
): Promise<string> {
  const { days_ahead = 7 } = args;

  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days_ahead);

  const todayStr = now.toISOString().split("T")[0];
  const futureStr = futureDate.toISOString().split("T")[0];

  // Fetch tasks
  const { data: tasks } = await local
    .from("tasks")
    .select("title, due_date, priority, completed")
    .eq("user_id", userId)
    .eq("completed", false)
    .gte("due_date", todayStr)
    .lte("due_date", futureStr)
    .order("due_date", { ascending: true });

  // Fetch milestones
  const { data: milestones } = await local
    .from("milestones")
    .select("title, date, type")
    .eq("user_id", userId)
    .gte("date", todayStr)
    .lte("date", futureStr)
    .order("date", { ascending: true });

  const items: string[] = [];

  if (milestones && milestones.length > 0) {
    items.push("**Milestones:**");
    for (const m of milestones) {
      items.push(`- ${m.date}: ${m.title} (${m.type})`);
    }
  }

  if (tasks && tasks.length > 0) {
    items.push("**Tasks:**");
    for (const t of tasks) {
      items.push(`- ${t.due_date}: ${t.title} [${t.priority}]`);
    }
  }

  if (items.length === 0) {
    return `No deadlines or tasks due in the next ${days_ahead} days.`;
  }

  return `Upcoming items (next ${days_ahead} days):\n\n${items.join("\n")}`;
}

// ─── Tool: Summarize Resource ──────────────────────────────────────────────────

interface SummarizeResourceArgs {
  resource_id?: string;
  title_search?: string;
}

export async function summarizeResource(
  local: LocalClient,
  userId: string,
  args: SummarizeResourceArgs,
): Promise<string> {
  const { resource_id, title_search } = args;

  let query = local
    .from("resources")
    .select("id, title, type, content_text, created_at")
    .eq("user_id", userId);

  if (resource_id) {
    query = query.eq("id", resource_id);
  } else if (title_search) {
    query = query.ilike("title", `%${title_search}%`);
  } else {
    // Get the most recent resource
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data: resources, error } = await query;

  if (error) {
    return `Failed to find resource: ${error.message}`;
  }

  if (!resources || resources.length === 0) {
    return "No matching resource found. Try uploading the document first.";
  }

  const resource = resources[0];

  if (!resource.content_text) {
    return `Found "${resource.title}" but its text content hasn't been extracted yet. Try re-uploading the file.`;
  }

  // Truncate to ~3000 words to stay within tool output limits
  const words = resource.content_text.split(/\s+/);
  const truncated =
    words.length > 3000
      ? words.slice(0, 3000).join(" ") + "\n\n[...content truncated for length]"
      : resource.content_text;

  return `Resource: "${resource.title}" (${resource.type})\nUploaded: ${resource.created_at}\n\nContent:\n${truncated}`;
}

// ─── Tool: List Resources ──────────────────────────────────────────────────────

interface ListResourcesArgs {
  limit?: number;
  subject_id?: string;
}

export async function listResources(
  local: LocalClient,
  userId: string,
  args: ListResourcesArgs,
): Promise<string> {
  const { limit = 20, subject_id } = args;

  let query = local
    .from("resources")
    .select("id, title, type, subject_id, created_at, content_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (subject_id) {
    query = query.eq("subject_id", subject_id);
  }

  const { data: resources, error } = await query;

  if (error) {
    return `Failed to list resources: ${error.message}`;
  }

  if (!resources || resources.length === 0) {
    return "No resources uploaded yet. The student should upload PDFs, documents, or text files via the Resource Library.";
  }

  const formatted = (
    resources as Array<{
      title: string;
      type: string;
      created_at?: string;
      content_text?: string | null;
    }>
  ).map((r, i) => {
    const hasContent = r.content_text && r.content_text.length > 0;
    const status = hasContent ? "✓ indexed" : "⚠ not indexed";
    return `${i + 1}. "${r.title}" (${r.type}) — uploaded ${r.created_at?.split("T")[0]} [${status}]`;
  });

  return `Found ${resources.length} uploaded resource${resources.length !== 1 ? "s" : ""}:\n\n${formatted.join("\n")}`;
}

// ─── Tool: Delete Task ─────────────────────────────────────────────────────────

interface DeleteTaskArgs {
  task_id?: string;
  title_search?: string;
}

export async function deleteTask(
  local: LocalClient,
  userId: string,
  args: DeleteTaskArgs,
): Promise<string> {
  const { task_id, title_search } = args;

  if (!task_id && !title_search) {
    return "Please provide either a task_id or title_search to identify the task to delete.";
  }

  // Find the task first
  let findQuery = local
    .from("tasks")
    .select("id, title, due_date, priority")
    .eq("user_id", userId);

  if (task_id) {
    findQuery = findQuery.eq("id", task_id);
  } else if (title_search) {
    findQuery = findQuery.ilike("title", `%${title_search}%`);
  }

  const { data: tasks, error: findError } = await findQuery.limit(1);

  if (findError) {
    return `Failed to find task: ${findError.message}`;
  }

  if (!tasks || tasks.length === 0) {
    return `No task found matching "${title_search || task_id}". Use list_tasks to see available tasks.`;
  }

  const task = tasks[0];

  // Delete it
  const { error: deleteError } = await local
    .from("tasks")
    .delete()
    .eq("id", task.id)
    .eq("user_id", userId);

  if (deleteError) {
    return `Failed to delete task: ${deleteError.message}`;
  }

  return `Deleted task: "${task.title}"${task.due_date ? ` (was due ${task.due_date})` : ""}.`;
}

// ─── Tool: Update Task ─────────────────────────────────────────────────────────

interface UpdateTaskArgs {
  task_id: string;
  title?: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  subject_id?: string;
  source_title?: string;
  source_url?: string;
  completed?: boolean;
}

export async function updateTask(
  local: LocalClient,
  userId: string,
  args: UpdateTaskArgs,
): Promise<string> {
  const { task_id, ...updates } = args;

  if (!task_id) {
    return "task_id is required. Use list_tasks to find the task ID first.";
  }

  // Build update object with only provided fields
  const updateFields: Record<string, unknown> = {};
  if (updates.title !== undefined) updateFields.title = updates.title;
  if (updates.description !== undefined)
    updateFields.description = updates.description;
  if (updates.due_date !== undefined) updateFields.due_date = updates.due_date;
  if (updates.due_time !== undefined) updateFields.due_time = updates.due_time;
  if (updates.priority !== undefined) updateFields.priority = updates.priority;
  if (updates.subject_id !== undefined)
    updateFields.subject_id = updates.subject_id;
  if (updates.source_title !== undefined)
    updateFields.source_title = updates.source_title;
  if (updates.source_url !== undefined)
    updateFields.source_url = updates.source_url;
  if (updates.completed !== undefined)
    updateFields.completed = updates.completed;

  if (Object.keys(updateFields).length === 0) {
    return "No fields to update. Provide at least one editable task field.";
  }

  const { data, error } = await local
    .from("tasks")
    .update(updateFields)
    .eq("id", task_id)
    .eq("user_id", userId)
    .select("id, title, due_date, due_time, priority, completed, source_title")
    .single();

  if (error) {
    return `Failed to update task: ${error.message}`;
  }

  const parts: string[] = [`Updated task: "${data.title}"`];
  if (updates.completed === true) parts.push("— marked as complete ✓");
  else if (updates.completed === false) parts.push("— reopened");
  if (updates.due_date) parts.push(`— due date set to ${data.due_date}`);
  if (updates.priority) parts.push(`— priority set to ${data.priority}`);

  if (updates.due_time) parts.push(`- due time set to ${data.due_time}`);
  if (updates.source_title) parts.push(`- source set to ${data.source_title}`);

  return parts.join(" ");
}

// ─── Tool: List Tasks ──────────────────────────────────────────────────────────

interface ListTasksArgs {
  completed?: boolean;
  subject_id?: string;
  limit?: number;
}

export async function listTasks(
  local: LocalClient,
  userId: string,
  args: ListTasksArgs,
): Promise<string> {
  const { completed, subject_id, limit = 20 } = args;

  let query = local
    .from("tasks")
    .select(
      "id, title, description, due_date, due_time, priority, completed, subject_id, source_title, source_url, created_at",
    )
    .eq("user_id", userId)
    .order("due_date", { ascending: true })
    .limit(limit);

  if (completed !== undefined) {
    query = query.eq("completed", completed);
  }

  if (subject_id) {
    query = query.eq("subject_id", subject_id);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return `Failed to list tasks: ${error.message}`;
  }

  if (!tasks || tasks.length === 0) {
    const filter =
      completed === true ? "completed " : completed === false ? "open " : "";
    return `No ${filter}tasks found.`;
  }

  const formatted = (
    tasks as Array<{
      id: string;
      title: string;
      description?: string | null;
      due_date: string | null;
      due_time?: string | null;
      priority: string;
      completed: boolean;
      source_title?: string | null;
      source_url?: string | null;
    }>
  ).map((t, i) => {
    const status = t.completed ? "✓" : "○";
    const due = t.due_date ? ` — due ${t.due_date}` : "";
    const dueTime = t.due_time ? ` at ${t.due_time}` : "";
    const description = t.description ? ` - ${t.description}` : "";
    const source = t.source_title
      ? ` - source: ${t.source_title}${t.source_url ? ` (${t.source_url})` : ""}`
      : "";
    return `${i + 1}. ${status} "${t.title}" [${t.priority}]${due}${dueTime}${description}${source} (id: ${t.id})`;
  });

  return `Found ${tasks.length} task${tasks.length !== 1 ? "s" : ""}:\n\n${formatted.join("\n")}`;
}

// ─── Tool: Delete Flashcards ───────────────────────────────────────────────────

interface DeleteFlashcardsArgs {
  flashcard_ids?: string[];
  subject_id?: string;
}

export async function deleteFlashcards(
  local: LocalClient,
  userId: string,
  args: DeleteFlashcardsArgs,
): Promise<string> {
  const { flashcard_ids, subject_id } = args;

  if (!flashcard_ids && !subject_id) {
    return "Please provide either flashcard_ids or subject_id to identify which flashcards to delete.";
  }

  let deleteQuery = local.from("flashcards").delete().eq("user_id", userId);

  if (flashcard_ids && flashcard_ids.length > 0) {
    deleteQuery = deleteQuery.in("id", flashcard_ids);
  } else if (subject_id) {
    deleteQuery = deleteQuery.eq("subject_id", subject_id);
  }

  const { data, error } = await deleteQuery.select("id");

  if (error) {
    return `Failed to delete flashcards: ${error.message}`;
  }

  const count = data?.length ?? 0;
  if (count === 0) {
    return "No matching flashcards found to delete.";
  }

  return `Deleted ${count} flashcard${count !== 1 ? "s" : ""}.`;
}

// ─── Tool: Get My Subjects ─────────────────────────────────────────────────────

export async function getMySubjects(
  local: LocalClient,
  userId: string,
): Promise<string> {
  const { data: subjects, error } = await local
    .from("user_subjects")
    .select("id, subject_name, level, subject_group, language")
    .eq("user_id", userId)
    .order("subject_group", { ascending: true });

  if (error) {
    return `Failed to load subjects: ${error.message}`;
  }

  if (!subjects || subjects.length === 0) {
    return "No subjects configured yet. The student should complete onboarding first.";
  }

  const formatted = (
    subjects as Array<{
      id: string;
      subject_name: string;
      level: string;
      subject_group: number;
      language: string;
    }>
  ).map(
    (s) =>
      `- ${s.subject_name} (${s.level}) — Group ${s.subject_group}, ${s.language} (id: ${s.id})`,
  );

  return `Student's IB subjects:\n\n${formatted.join("\n")}`;
}

// ─── Tool: Get IA Status ───────────────────────────────────────────────────────

interface GetIAStatusArgs {
  subject_id?: string;
}

export async function getIAStatus(
  local: LocalClient,
  userId: string,
  args: GetIAStatusArgs,
): Promise<string> {
  const { subject_id } = args;

  let query = local
    .from("internal_assessments")
    .select(
      "id, title, subject_id, status, stage, word_count, deadline, created_at",
    )
    .eq("user_id", userId);

  if (subject_id) {
    query = query.eq("subject_id", subject_id);
  }

  const { data: ias, error } = await query.order("deadline", {
    ascending: true,
  });

  if (error) {
    return `Failed to load IA status: ${error.message}`;
  }

  if (!ias || ias.length === 0) {
    return "No Internal Assessments tracked yet. The student can add IAs from the IA Manager page.";
  }

  const formatted = (
    ias as Array<{
      title: string;
      status: string | null;
      stage: string | null;
      word_count: number | null;
      deadline: string | null;
    }>
  ).map((ia) => {
    const parts = [`- "${ia.title}"`];
    if (ia.status) parts.push(`[${ia.status}]`);
    if (ia.stage) parts.push(`Stage: ${ia.stage}`);
    if (ia.word_count) parts.push(`${ia.word_count} words`);
    if (ia.deadline) parts.push(`Due: ${ia.deadline}`);
    return parts.join(" — ");
  });

  return `Internal Assessment progress:\n\n${formatted.join("\n")}`;
}

// ─── Tool: Get Syllabus Progress ───────────────────────────────────────────────

interface GetSyllabusProgressArgs {
  subject_id: string;
}

export async function getSyllabusProgress(
  local: LocalClient,
  userId: string,
  args: GetSyllabusProgressArgs,
): Promise<string> {
  const { subject_id } = args;

  if (!subject_id) {
    return "subject_id is required. Use get_my_subjects to find the subject ID first.";
  }

  const { data: progress, error } = await local
    .from("syllabus_progress")
    .select("topic, unit, completed")
    .eq("user_id", userId)
    .eq("subject_id", subject_id)
    .order("unit", { ascending: true });

  if (error) {
    return `Failed to load syllabus progress: ${error.message}`;
  }

  if (!progress || progress.length === 0) {
    return "No syllabus progress tracked for this subject yet. Topics will appear once the student starts marking them complete.";
  }

  const total = progress.length;
  const done = (progress as Array<{ completed: boolean }>).filter(
    (p) => p.completed,
  ).length;
  const pct = Math.round((done / total) * 100);

  const formatted = (
    progress as Array<{
      topic: string;
      unit: string | null;
      completed: boolean;
    }>
  ).map(
    (p) =>
      `- ${p.completed ? "✓" : "○"} ${p.unit ? `[${p.unit}] ` : ""}${p.topic}`,
  );

  return `Syllabus progress: ${done}/${total} topics complete (${pct}%)\n\n${formatted.join("\n")}`;
}

// ─── Tool: List Notes ──────────────────────────────────────────────────────────

interface ListNotesArgs {
  subject_id?: string;
  search?: string;
  limit?: number;
}

export async function listNotes(
  local: LocalClient,
  userId: string,
  args: ListNotesArgs,
): Promise<string> {
  const { subject_id, search, limit = 20 } = args;

  let query = local
    .from("notes")
    .select("id, title, subject_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (subject_id) {
    query = query.eq("subject_id", subject_id);
  }

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data: notes, error } = await query;

  if (error) {
    return `Failed to list notes: ${error.message}`;
  }

  if (!notes || notes.length === 0) {
    return "No notes found. The student can create notes from the Subjects page.";
  }

  const formatted = (
    notes as Array<{
      id: string;
      title: string;
      updated_at: string | null;
      created_at: string;
    }>
  ).map((n, i) => {
    const date = (n.updated_at || n.created_at)?.split("T")[0];
    return `${i + 1}. "${n.title}" — updated ${date} (id: ${n.id})`;
  });

  return `Found ${notes.length} note${notes.length !== 1 ? "s" : ""}:\n\n${formatted.join("\n")}`;
}

// Roadmap tools

export async function getRoadmapOverview(
  local: LocalClient,
  userId: string,
  args: Pick<RoadmapFindArgs, "include_hidden" | "limit" | "from" | "to">,
): Promise<string> {
  try {
    const overview = await getRoadmapOverviewAction(userId, args, local);
    const counts = overview.counts;
    const lines = [
      `Roadmap overview: ${counts.open} open, ${counts.visible} visible, ${counts.hidden} hidden, ${counts.total} total.`,
    ];

    if (overview.insight?.summary) {
      lines.push(`Insight: ${overview.insight.summary}`);
    }
    if (overview.next_focus.length > 0) {
      lines.push(
        `Next focus:\n${overview.next_focus.map(formatRoadmapItemLine).join("\n")}`,
      );
    }
    if (overview.risks.length > 0) {
      lines.push(
        `Risks:\n${overview.risks.map((risk) => `- ${risk}`).join("\n")}`,
      );
    }
    if (overview.timeline.length > 0) {
      lines.push(
        `Timeline slice:\n${overview.timeline.map(formatRoadmapItemLine).join("\n")}`,
      );
    }

    return lines.join("\n\n");
  } catch (cause) {
    return formatRoadmapToolError("Roadmap overview failed", cause);
  }
}

export async function findRoadmapItems(
  local: LocalClient,
  userId: string,
  args: RoadmapFindArgs,
): Promise<string> {
  try {
    const items = await findRoadmapItemsAction(userId, args, local);
    if (items.length === 0) {
      return "No matching roadmap items found. Hidden items are excluded unless include_hidden is true.";
    }

    return `Found ${items.length} roadmap item${items.length === 1 ? "" : "s"}:\n\n${items
      .map(formatRoadmapItemLine)
      .join("\n")}`;
  } catch (cause) {
    return formatRoadmapToolError("Roadmap search failed", cause);
  }
}

export async function createRoadmapItem(
  local: LocalClient,
  userId: string,
  args: RoadmapCreateArgs,
): Promise<string> {
  try {
    const item = await createRoadmapItemAction(userId, args, local);
    return `Created roadmap item:\n${formatRoadmapItemLine(item)}`;
  } catch (cause) {
    return formatRoadmapToolError("Roadmap item create failed", cause);
  }
}

export async function updateRoadmapItem(
  local: LocalClient,
  userId: string,
  args: RoadmapUpdateArgs,
): Promise<string> {
  try {
    const item = await updateRoadmapItemAction(userId, args, local);
    return `Updated roadmap item:\n${formatRoadmapItemLine(item)}`;
  } catch (cause) {
    return formatRoadmapToolError("Roadmap item update failed", cause);
  }
}

export async function splitRoadmapItem(
  local: LocalClient,
  userId: string,
  args: RoadmapSplitArgs,
): Promise<string> {
  try {
    const children = await splitRoadmapItemAction(userId, args, local);
    return `Created ${children.length} child checkpoint${children.length === 1 ? "" : "s"}:\n\n${children
      .map(formatRoadmapItemLine)
      .join("\n")}`;
  } catch (cause) {
    return formatRoadmapToolError("Roadmap item split failed", cause);
  }
}

export async function linkRoadmapItem(
  local: LocalClient,
  userId: string,
  args: { id?: string; kind?: "task" | "milestone" },
): Promise<string> {
  try {
    const result = await linkRoadmapItemAction(userId, args, local);
    const action = result.reused ? "Reused linked" : "Created linked";
    return `${action} ${result.kind} for roadmap item ${result.item.id}: ${result.linked_id}`;
  } catch (cause) {
    return formatRoadmapToolError("Roadmap item link failed", cause);
  }
}

export async function regenerateRoadmap(
  local: LocalClient,
  userId: string,
  args: { use_ai?: boolean; ai?: boolean },
): Promise<string> {
  try {
    const data = await regenerateRoadmapAction(
      userId,
      { use_ai: args.use_ai ?? args.ai },
      local,
    );
    const nextItems = data.items
      .filter((item) => item.status !== "done")
      .slice(0, 8);
    const lines = [
      `Regenerated roadmap with ${data.items.length} visible item${data.items.length === 1 ? "" : "s"}.`,
    ];
    if (data.insight?.summary) lines.push(`Insight: ${data.insight.summary}`);
    if (nextItems.length > 0) {
      lines.push(
        `Next items:\n${nextItems.map(formatRoadmapItemLine).join("\n")}`,
      );
    }
    return lines.join("\n\n");
  } catch (cause) {
    return formatRoadmapToolError("Roadmap regenerate failed", cause);
  }
}

function formatRoadmapItemLine(item: RoadmapItem) {
  const dates = [
    item.start_date ? `start ${item.start_date}` : null,
    item.due_date ? `due ${item.due_date}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const subject = item.subject_id ? `, subject ${item.subject_id}` : "";
  const parent = item.parent_id ? `, parent ${item.parent_id}` : "";
  const hidden = item.hidden ? ", hidden" : "";
  return `- "${item.title}" (${item.category}, ${item.status}, ${item.priority}${subject}${parent}${hidden}, id: ${item.id}${dates ? `, ${dates}` : ""})`;
}

function formatRoadmapToolError(prefix: string, cause: unknown) {
  const error = toRoadmapRouteError(cause);
  return `${prefix}: ${error.message}`;
}
