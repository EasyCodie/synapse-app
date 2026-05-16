import { generateEmbedding } from "@/lib/embeddings";
import type { createClient } from "@/lib/local/client";

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
  args: SearchResourcesArgs
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
      (r: { metadata: { title?: string }; source_type: string; content_text: string; similarity: number }, i: number) => {
        const title = r.metadata?.title ?? r.source_type;
        return `[Source ${i + 1}] "${title}" (${(r.similarity * 100).toFixed(0)}% match)\n${r.content_text}`;
      }
    );

    return formatted.join("\n\n---\n\n");
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

// ─── Tool: Create Flashcards ───────────────────────────────────────────────────

interface CreateFlashcardsArgs {
  flashcards: Array<{ front: string; back: string; tags?: string[] }>;
  subject_id?: string;
}

export async function createFlashcards(
  local: LocalClient,
  userId: string,
  args: CreateFlashcardsArgs
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
  priority?: "low" | "medium" | "high" | "urgent";
  subject_id?: string;
}

export async function createTask(
  local: LocalClient,
  userId: string,
  args: CreateTaskArgs
): Promise<string> {
  const { title, description, due_date, priority = "medium", subject_id } = args;

  const { data, error } = await local
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      description: description || null,
      due_date: due_date || null,
      priority,
      subject_id: subject_id || null,
      completed: false,
    })
    .select("id, title, due_date, priority")
    .single();

  if (error) {
    return `Failed to create task: ${error.message}`;
  }

  let result = `Task created: "${data.title}" (${data.priority} priority)`;
  if (data.due_date) {
    result += ` — due ${data.due_date}`;
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
  args: GetUpcomingDeadlinesArgs
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
  args: SummarizeResourceArgs
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
  const truncated = words.length > 3000
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
  args: ListResourcesArgs
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

  const formatted = (resources as Array<{
    title: string;
    type: string;
    created_at?: string;
    content_text?: string | null;
  }>).map((r, i) => {
    const hasContent = r.content_text && r.content_text.length > 0;
    const status = hasContent ? "✓ indexed" : "⚠ not indexed";
    return `${i + 1}. "${r.title}" (${r.type}) — uploaded ${r.created_at?.split("T")[0]} [${status}]`;
  });

  return `Found ${resources.length} uploaded resource${resources.length !== 1 ? "s" : ""}:\n\n${formatted.join("\n")}`;
}
