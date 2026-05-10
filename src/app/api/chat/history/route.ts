import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/chat/history — Returns last 50 chat messages for the authenticated user.
 * Messages are returned in chronological order (oldest first).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, sources, tool_calls, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 }
    );
  }

  // Return in chronological order (oldest first)
  return NextResponse.json({ messages: (messages ?? []).reverse() });
}

/**
 * DELETE /api/chat/history — Clears all chat messages for the authenticated user.
 */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("chat_messages")
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
