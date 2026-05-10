import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get resource to find file path
  const { data: resource } = await supabase
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
    await supabase.storage.from("resources").remove([resource.file_path]);
  }

  // Delete embeddings
  await supabase
    .from("embeddings")
    .delete()
    .eq("user_id", user.id)
    .eq("source_type", "resource")
    .eq("source_id", id);

  // Delete resource record
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
