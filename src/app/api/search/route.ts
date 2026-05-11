import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().min(1).max(500),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ q: searchParams.get("q") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const queryEmbedding = await generateEmbedding(parsed.data.q);

    const { data: results, error } = await supabase.rpc("search_embeddings", {
      query_embedding: queryEmbedding,
      match_user_id: user.id,
      match_threshold: 0.35,
      match_count: 15,
    });

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json({ results: [] });
    }

    return NextResponse.json({ results: results ?? [] });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ results: [] });
  }
}
