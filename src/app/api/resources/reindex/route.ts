import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";
import { extractPdfText } from "@/lib/extract-pdf";

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

/**
 * POST /api/resources/reindex
 * Re-extracts text from a resource's stored file and generates embeddings.
 * Body: { resource_id: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const { data: resource, error: fetchError } = await supabase
    .from("resources")
    .select("id, title, type, file_path, content_text")
    .eq("id", resource_id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  let contentText = resource.content_text;

  // If no content_text, try to re-extract from storage
  if (!contentText && resource.file_path) {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resources")
      .download(resource.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: `Could not download file: ${downloadError?.message}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();

    if (resource.type === "pdf") {
      try {
        contentText = await extractPdfText(arrayBuffer);
      } catch (err) {
        console.error("PDF re-extraction failed:", err);
        return NextResponse.json(
          { error: "PDF text extraction failed" },
          { status: 500 }
        );
      }
    } else {
      contentText = Buffer.from(arrayBuffer).toString("utf-8");
    }

    // Update resource with extracted text
    if (contentText) {
      await supabase
        .from("resources")
        .update({ content_text: contentText })
        .eq("id", resource_id);
    }
  }

  if (!contentText || contentText.length < 10) {
    return NextResponse.json(
      { error: "No text content available for this resource" },
      { status: 400 }
    );
  }

  // Delete existing embeddings for this resource
  await supabase
    .from("embeddings")
    .delete()
    .eq("source_id", resource_id)
    .eq("user_id", user.id);

  // Chunk and embed
  const chunks = chunkText(contentText);
  let embeddedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await generateEmbedding(chunks[i]);

      const { error: insertError } = await supabase.from("embeddings").insert({
        user_id: user.id,
        source_type: "resource",
        source_id: resource_id,
        chunk_index: i,
        content_text: chunks[i],
        embedding: embedding,
        metadata: { title: resource.title, chunk_index: i, total_chunks: chunks.length },
      });

      if (!insertError) {
        embeddedCount++;
      }
    } catch (err) {
      console.error(`Embedding chunk ${i} failed:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    chunks_total: chunks.length,
    chunks_embedded: embeddedCount,
    content_length: contentText.length,
  });
}
