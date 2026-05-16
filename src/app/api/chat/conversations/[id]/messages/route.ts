import { createClient } from "@/lib/local/client";
import { NextResponse } from "next/server";

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

  const { data: conversation, error: conversationError } = await local
    .from("chat_conversations")
    .select("id, title, created_at, updated_at, last_message_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: messages, error } = await local
    .from("chat_messages")
    .select("id, conversation_id, role, content, sources, tool_calls, created_at")
    .eq("user_id", user.id)
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversation, messages: messages ?? [] });
}
