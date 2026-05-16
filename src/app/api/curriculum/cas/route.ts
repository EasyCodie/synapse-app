import { NextRequest, NextResponse } from "next/server";
import { CAS_TYPES } from "@/lib/curriculum-shared";
import { createClient } from "@/lib/local/client";

const CAS_TYPE_SET = new Set<string>(CAS_TYPES);

export async function POST(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const type = typeof body.type === "string" && CAS_TYPE_SET.has(body.type)
    ? body.type
    : "";

  if (!title || !type) {
    return NextResponse.json(
      { error: "title and valid type are required" },
      { status: 400 }
    );
  }

  const { data, error } = await local
    .from("cas_experiences")
    .insert({
      user_id: user.id,
      title,
      type,
      description: typeof body.description === "string" ? body.description.trim() : "",
      status: typeof body.status === "string" ? body.status : "planned",
      learning_outcomes: [],
      reflections: [],
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ experience: data }, { status: 201 });
}

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
  if (typeof body.description === "string") {
    updates.description = body.description.trim();
  }
  if (typeof body.status === "string") updates.status = body.status;
  if (typeof body.type === "string" && CAS_TYPE_SET.has(body.type)) {
    updates.type = body.type;
  }
  if (Array.isArray(body.learning_outcomes)) {
    updates.learning_outcomes = body.learning_outcomes;
  }
  if (Array.isArray(body.reflections)) updates.reflections = body.reflections;

  const { data, error } = await local
    .from("cas_experiences")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ experience: data });
}

export async function DELETE(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await local
    .from("cas_experiences")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
