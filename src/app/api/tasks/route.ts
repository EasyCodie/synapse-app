import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";

const TASK_COLUMNS =
  "id, title, description, due_date, due_time, priority, completed, subject_id, source_title, source_url, created_at, updated_at";

const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

type TaskBody = {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  due_date?: unknown;
  due_time?: unknown;
  priority?: unknown;
  completed?: unknown;
  subject_id?: unknown;
  source_title?: unknown;
  source_url?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 10);
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function cleanTime(value: unknown) {
  const text = cleanText(value, 5);
  if (!text) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : undefined;
}

function cleanPriority(value: unknown) {
  if (typeof value !== "string" || !PRIORITIES.has(value)) return undefined;
  return value as "low" | "medium" | "high" | "urgent";
}

function optionalField(body: TaskBody, key: keyof TaskBody, maxLength: number) {
  return Object.prototype.hasOwnProperty.call(body, key)
    ? cleanText(body[key], maxLength)
    : undefined;
}

async function validateSubject(
  local: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  subjectId: string | null,
) {
  if (!subjectId) return { ok: true as const };

  const { data, error } = await local
    .from("user_subjects")
    .select("id")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      error: "subject_id does not belong to this workspace",
    };
  }

  return { ok: true as const };
}

// GET /api/tasks — list tasks (optionally filter by completed, due range)
export async function GET(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const completed = searchParams.get("completed");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = local
    .from("tasks")
    .select(TASK_COLUMNS)
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })
    .limit(500);

  if (completed === "true") query = query.eq("completed", true);
  if (completed === "false") query = query.eq("completed", false);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
}

// POST /api/tasks — create a task
export async function POST(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as TaskBody;
  const title = cleanText(body.title, 160);
  const dueDate = cleanDate(body.due_date);
  const dueTime = cleanTime(body.due_time);
  const priority = cleanPriority(body.priority) ?? "medium";
  const subjectId = cleanText(body.subject_id, 80);

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (dueDate === undefined) {
    return NextResponse.json(
      { error: "due_date must use YYYY-MM-DD format" },
      { status: 400 },
    );
  }
  if (dueTime === undefined) {
    return NextResponse.json(
      { error: "due_time must use HH:mm format" },
      { status: 400 },
    );
  }

  const subjectResult = await validateSubject(local, user.id, subjectId);
  if (!subjectResult.ok) {
    return NextResponse.json({ error: subjectResult.error }, { status: 400 });
  }

  const { data, error } = await local
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      description: cleanText(body.description, 1000),
      due_date: dueDate,
      due_time: dueTime,
      priority,
      subject_id: subjectId,
      source_title: cleanText(body.source_title, 160),
      source_url: cleanText(body.source_url, 500),
      completed: false,
    })
    .select(TASK_COLUMNS)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data }, { status: 201 });
}

// PATCH /api/tasks — update a task (toggle complete, edit fields)
export async function PATCH(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as TaskBody;
  const id = cleanText(body.id, 80);

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = cleanText(body.title, 160);
    if (!title)
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    updates.title = title;
  }

  const description = optionalField(body, "description", 1000);
  if (description !== undefined) updates.description = description;

  if (Object.prototype.hasOwnProperty.call(body, "due_date")) {
    const dueDate = cleanDate(body.due_date);
    if (dueDate === undefined) {
      return NextResponse.json(
        { error: "due_date must use YYYY-MM-DD format" },
        { status: 400 },
      );
    }
    updates.due_date = dueDate;
  }

  if (Object.prototype.hasOwnProperty.call(body, "due_time")) {
    const dueTime = cleanTime(body.due_time);
    if (dueTime === undefined) {
      return NextResponse.json(
        { error: "due_time must use HH:mm format" },
        { status: 400 },
      );
    }
    updates.due_time = dueTime;
  }

  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    const priority = cleanPriority(body.priority);
    if (!priority)
      return NextResponse.json(
        { error: "priority is invalid" },
        { status: 400 },
      );
    updates.priority = priority;
  }

  if (Object.prototype.hasOwnProperty.call(body, "completed")) {
    if (typeof body.completed !== "boolean") {
      return NextResponse.json(
        { error: "completed must be a boolean" },
        { status: 400 },
      );
    }
    updates.completed = body.completed;
  }

  if (Object.prototype.hasOwnProperty.call(body, "subject_id")) {
    const subjectId = cleanText(body.subject_id, 80);
    const subjectResult = await validateSubject(local, user.id, subjectId);
    if (!subjectResult.ok) {
      return NextResponse.json({ error: subjectResult.error }, { status: 400 });
    }
    updates.subject_id = subjectId;
  }

  const sourceTitle = optionalField(body, "source_title", 160);
  if (sourceTitle !== undefined) updates.source_title = sourceTitle;

  const sourceUrl = optionalField(body, "source_url", 500);
  if (sourceUrl !== undefined) updates.source_url = sourceUrl;

  const { data, error } = await local
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select(TASK_COLUMNS)
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ task: data });
}

// DELETE /api/tasks — delete a task
export async function DELETE(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await local
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
