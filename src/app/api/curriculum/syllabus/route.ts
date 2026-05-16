import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";

export async function PATCH(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { id?: unknown; completed?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const completed = typeof body.completed === "boolean" ? body.completed : null;

  if (!id || completed === null) {
    return NextResponse.json(
      { error: "id and completed are required" },
      { status: 400 }
    );
  }

  const { data, error } = await local
    .from("syllabus_progress")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, completed")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ syllabus: data });
}
