import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function normalizeTitle(value: unknown) {
  const title = typeof value === "string" ? value.trim() : "";
  return title.length > 0 ? title.slice(0, 120) : "New chat";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: conversations, error } = await supabase
    .from("chat_conversations")
    .select("id, title, created_at, updated_at, last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversations: conversations ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { title?: unknown };
  const title = normalizeTitle(body.title);

  const { data: conversation, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, created_at, updated_at, last_message_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ conversation }, { status: 201 });
}
