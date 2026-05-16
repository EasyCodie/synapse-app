import { createClient } from "@/lib/local/client";
import { NextResponse } from "next/server";

/**
 * GET /api/chat/history — Compatibility endpoint for the active/latest chat.
 * Messages are returned in chronological order (oldest first).
 */
export async function GET(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedConversationId = searchParams.get("conversation_id");

  let conversationQuery = local
    .from("chat_conversations")
    .select("id, title, created_at, updated_at, last_message_at")
    .eq("user_id", user.id);

  if (requestedConversationId) {
    conversationQuery = conversationQuery.eq("id", requestedConversationId);
  } else {
    conversationQuery = conversationQuery
      .order("last_message_at", { ascending: false })
      .limit(1);
  }

  const { data: conversations, error: conversationError } = await conversationQuery;

  if (conversationError) {
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }

  const conversation = conversations?.[0] ?? null;

  if (!conversation) {
    return NextResponse.json({ conversation: null, messages: [] });
  }

  const { data: messages, error } = await local
    .from("chat_messages")
    .select("id, role, content, sources, tool_calls, created_at")
    .eq("user_id", user.id)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }

  // Return in chronological order (oldest first)
  return NextResponse.json({ conversation, messages: (messages ?? []).reverse() });
}

/**
 * DELETE /api/chat/history — Clears chat history for compatibility.
 */
export async function DELETE(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedConversationId = searchParams.get("conversation_id");

  if (requestedConversationId) {
    const { error } = await local
      .from("chat_messages")
      .delete()
      .eq("user_id", user.id)
      .eq("conversation_id", requestedConversationId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to clear history" },
        { status: 500 }
      );
    }

    await local
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", requestedConversationId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  }

  const { error } = await local
    .from("chat_conversations")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to clear history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
