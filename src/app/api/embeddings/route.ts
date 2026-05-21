import { createClient } from "@/lib/local/client";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";
import { clearRoadmapInsightCache } from "@/lib/roadmap-ai";
import { createEmbeddingChunks } from "@/lib/resource-chunking";
import { z } from "zod";

const EmbeddingRequestSchema = z.object({
  source_type: z.enum(["note", "resource", "ia"]),
  source_id: z.string().uuid(),
  content_text: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const local = await createClient();
  const { data: { user } } = await local.auth.getUser();

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
    await local
      .from("embeddings")
      .delete()
      .eq("user_id", user.id)
      .eq("source_type", source_type)
      .eq("source_id", source_id);

    // Chunk and embed
    const chunks = createEmbeddingChunks(content_text, {
      ...(metadata ?? {}),
      source_type,
      source_id,
    });
    const embeddingRows = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;
      const embedding = await generateEmbedding(chunk.content_text);
      embeddingRows.push({
        user_id: user.id,
        source_type,
        source_id,
        chunk_index: chunk.metadata.chunk_index,
        content_text: chunk.content_text,
        embedding,
        metadata: chunk.metadata,
      });
    }

    const { error } = await local.from("embeddings").insert(embeddingRows);

    if (error) {
      if (source_type === "resource") {
        await local
          .from("resources")
          .update({ indexing_status: "failed", last_index_error: error.message })
          .eq("id", source_id)
          .eq("user_id", user.id);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (source_type === "resource") {
      await local
        .from("resources")
        .update({
          indexing_status: "indexed",
          indexed_at: new Date().toISOString(),
          last_index_error: null,
        })
        .eq("id", source_id)
        .eq("user_id", user.id);
    }

    clearRoadmapInsightCache();
    return NextResponse.json({ success: true, chunks: embeddingRows.length });
  } catch (err) {
    console.error("Embedding error:", err);
    if (source_type === "resource") {
      await local
        .from("resources")
        .update({
          indexing_status: "failed",
          last_index_error:
            err instanceof Error ? err.message : "Embedding generation failed",
        })
        .eq("id", source_id)
        .eq("user_id", user.id);
    }
    return NextResponse.json({ error: "Embedding generation failed" }, { status: 500 });
  }
}
