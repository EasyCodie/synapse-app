import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";
import { z } from "zod";

const EmbeddingRequestSchema = z.object({
  source_type: z.enum(["note", "resource", "ia"]),
  source_id: z.string().uuid(),
  content_text: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (chunk.trim()) chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = EmbeddingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { source_type, source_id, content_text, metadata } = parsed.data;

  try {
    // Delete existing embeddings for this source
    await supabase
      .from("embeddings")
      .delete()
      .eq("user_id", user.id)
      .eq("source_type", source_type)
      .eq("source_id", source_id);

    // Chunk and embed
    const chunks = chunkText(content_text);
    const embeddingRows = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const embedding = await generateEmbedding(chunk);
      embeddingRows.push({
        user_id: user.id,
        source_type,
        source_id,
        chunk_index: i,
        content_text: chunk,
        embedding,
        metadata: metadata ?? {},
      });
    }

    const { error } = await supabase.from("embeddings").insert(embeddingRows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, chunks: embeddingRows.length });
  } catch (err) {
    console.error("Embedding error:", err);
    return NextResponse.json({ error: "Embedding generation failed" }, { status: 500 });
  }
}
