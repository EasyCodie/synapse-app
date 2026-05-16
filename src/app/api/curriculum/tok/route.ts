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
  if (typeof body.essay_title === "string") {
    updates.essay_title = body.essay_title.trim();
  }
  if (typeof body.prescribed_title === "string") {
    updates.prescribed_title = body.prescribed_title.trim();
  }
  if (typeof body.status === "string" && STATUS_SET.has(body.status)) {
    updates.status = body.status;
  }
  if (Array.isArray(body.exhibition_objects)) {
    updates.exhibition_objects = body.exhibition_objects;
  }

  const { data, error } = await local
    .from("tok_tracker")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tok: data });
}
