import { createClient } from "@/lib/local/client";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";
import { clearRoadmapInsightCache } from "@/lib/roadmap-ai";
import { createEmbeddingChunks } from "@/lib/resource-chunking";
import {
  extractResourceTextFromBuffer,
  getExtractionStatus,
  inferResourceMimeType,
  sanitizeExtractedText,
} from "@/lib/resource-upload";

/**
 * POST /api/resources/reindex
 * Re-extracts text from a resource's stored file and generates embeddings.
 * Body: { resource_id: string }
 */
export async function POST(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resource_id } = (await request.json()) as { resource_id?: string };

  if (!resource_id) {
    return NextResponse.json(
      { error: "resource_id required" },
      { status: 400 }
    );
  }

  // Fetch the resource
  const { data: resource, error: fetchError } = await local
    .from("resources")
    .select("id, title, type, file_path, content_text, mime_type, source_url")
    .eq("id", resource_id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let contentText = resource.content_text ?? "";
  let extractionStatus = getExtractionStatus(contentText, Boolean(contentText));

  await local
    .from("resources")
    .update({ indexing_status: "indexing", last_index_error: null })
    .eq("id", resource_id)
    .eq("user_id", user.id);

  if (resource.file_path) {
    const { data: fileData, error: downloadError } = await local.storage
      .from("resources")
      .download(resource.file_path);

    if (downloadError || !fileData) {
      await local
        .from("resources")
        .update({
          indexing_status: "failed",
          last_index_error: `Could not download file: ${downloadError?.message}`,
        })
        .eq("id", resource_id)
        .eq("user_id", user.id);
      return NextResponse.json(
        { error: `Could not download file: ${downloadError?.message}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    contentText = sanitizeExtractedText(
      await extractResourceTextFromBuffer(arrayBuffer, inferResourceMimeType(resource))
    );
    extractionStatus = getExtractionStatus(contentText, true);

    await local
      .from("resources")
      .update({
        content_text: contentText || null,
        extraction_status: extractionStatus,
      })
      .eq("id", resource_id)
      .eq("user_id", user.id);
  }

  if (!contentText || contentText.length < 10) {
    await local
      .from("resources")
      .update({
        indexing_status: "not_started",
        last_index_error: "No text content available for this resource",
      })
      .eq("id", resource_id)
      .eq("user_id", user.id);
    return NextResponse.json(
      {
        error: "No text content available for this resource",
        extraction_status: extractionStatus,
        indexing_status: "not_started",
        content_length: contentText.length,
      },
      { status: 400 }
    );
  }

  // Delete existing embeddings for this resource
  await local
    .from("embeddings")
    .delete()
    .eq("source_id", resource_id)
    .eq("user_id", user.id);

  // Chunk and embed
  const chunks = createEmbeddingChunks(contentText, {
    title: resource.title,
    file_type: inferResourceMimeType(resource),
    source_url: resource.source_url ?? undefined,
    source_type: "resource",
    source_id: resource_id,
  });
  let embeddedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const chunk = chunks[i];
      if (!chunk) continue;
      const embedding = await generateEmbedding(chunk.content_text);

      const { error: insertError } = await local.from("embeddings").insert({
        user_id: user.id,
        source_type: "resource",
        source_id: resource_id,
        chunk_index: chunk.metadata.chunk_index,
        content_text: chunk.content_text,
        embedding: embedding,
        metadata: chunk.metadata,
      });

      if (!insertError) {
        embeddedCount++;
      }
    } catch (err) {
      console.error(`Embedding chunk ${i} failed:`, err);
    }
  }

  const indexingStatus = embeddedCount === chunks.length ? "indexed" : "failed";
  await local
    .from("resources")
    .update({
      indexing_status: indexingStatus,
      indexed_at: indexingStatus === "indexed" ? new Date().toISOString() : null,
      last_index_error:
        indexingStatus === "indexed"
          ? null
          : `Embedded ${embeddedCount} of ${chunks.length} chunks`,
    })
    .eq("id", resource_id)
    .eq("user_id", user.id);

  clearRoadmapInsightCache();
  return NextResponse.json({
    success: indexingStatus === "indexed",
    extraction_status: extractionStatus,
    indexing_status: indexingStatus,
    chunks_total: chunks.length,
    chunks_embedded: embeddedCount,
    content_length: contentText.length,
  });
}
