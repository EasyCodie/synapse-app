import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/local/client";

export async function POST(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    subject_id?: unknown;
    title?: unknown;
    folder_path?: unknown;
  };
  const subjectId = typeof body.subject_id === "string" ? body.subject_id : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const folderPath = typeof body.folder_path === "string" ? body.folder_path.trim() : "";

  if (!subjectId || !title) {
    return NextResponse.json(
      { error: "subject_id and title are required" },
      { status: 400 }
    );
  }

  const { data, error } = await local
    .from("notes")
    .insert({
      user_id: user.id,
      subject_id: subjectId,
      title,
      folder_path: folderPath || "Notes",
      content: "",
      updated_at: new Date().toISOString(),
    })
    .select("id, title, updated_at, folder_path")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    id?: unknown;
    title?: unknown;
    folder_path?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : "";
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const folderPath =
    typeof body.folder_path === "string" ? body.folder_path.trim() : undefined;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (folderPath !== undefined) updates.folder_path = folderPath || "Notes";

  const { data, error } = await local
    .from("notes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, updated_at, folder_path")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ note: data });
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
    .from("notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
