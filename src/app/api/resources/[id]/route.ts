import { createClient } from "@/lib/local/client";
import { getResourcePreview } from "@/lib/resource-preview";
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

  const preview = await getResourcePreview(local, user.id, id);

  if (!preview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(preview);
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

  // Get resource to find file path
  const { data: resource } = await local
    .from("resources")
    .select("id, file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!resource) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete file from storage
  if (resource.file_path) {
    await local.storage.from("resources").remove([resource.file_path]);
  }

  // Delete embeddings
  await local
    .from("embeddings")
    .delete()
    .eq("user_id", user.id)
    .eq("source_type", "resource")
    .eq("source_id", id);

  // Delete resource record
  const { error } = await local
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
