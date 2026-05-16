import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";
import { CORE_STATUSES } from "@/lib/curriculum-shared";

const STATUS_SET = new Set<string>(CORE_STATUSES);

export async function PATCH(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.subject === "string") updates.subject = body.subject.trim();
  if (typeof body.supervisor === "string") updates.supervisor = body.supervisor.trim();
  if (typeof body.research_question === "string") {
    updates.research_question = body.research_question.trim();
  }
  if (typeof body.status === "string" && STATUS_SET.has(body.status)) {
    updates.status = body.status;
  }
  if (typeof body.word_count === "number" && Number.isFinite(body.word_count)) {
    updates.word_count = Math.max(0, Math.round(body.word_count));
  }
  if (Array.isArray(body.milestones)) updates.milestones = body.milestones;

  const { data, error } = await local
    .from("ee_tracker")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ee: data });
}
