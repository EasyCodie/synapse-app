import { createClient } from "@/lib/local/client";
import { NextResponse } from "next/server";

function normalizeTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  return title.length > 0 ? title.slice(0, 120) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: conversation, error } = await local
    .from("chat_conversations")
    .select("id, title, created_at, updated_at, last_message_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { title?: unknown };
  const title = normalizeTitle(body.title);

  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const { data: conversation, error } = await local
    .from("chat_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, created_at, updated_at, last_message_at")
    .single();

  if (error || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await local
    .from("chat_conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
