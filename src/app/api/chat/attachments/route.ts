import { NextResponse } from "next/server";
import {
  CHAT_ATTACHMENT_ALLOWED_MIME_TYPES,
  CHAT_ATTACHMENT_MAX_BYTES,
  extractResourceText,
  getExtractionStatus,
  getIndexingStatus,
  getResourceType,
  isAllowedMimeType,
  RESOURCE_BUCKET,
  sanitizeExtractedText,
  sanitizeResourceFilename,
} from "@/lib/resource-upload";
import { createClient } from "@/lib/local/client";

export async function POST(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const subjectId = formData.get("subject_id") as string | null;
  const title = ((formData.get("title") as string | null) || file?.name || "Untitled").trim();

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAllowedMimeType(file.type, CHAT_ATTACHMENT_ALLOWED_MIME_TYPES)) {
    return NextResponse.json(
      { error: "Unsupported file type. Attach PDF, DOCX, or TXT files only." },
      { status: 400 }
    );
  }

  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 }
    );
  }

  try {
    const sanitizedName = sanitizeResourceFilename(file.name || title);
    const filePath = `${user.id}/chat/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await local.storage
      .from(RESOURCE_BUCKET)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${(uploadError as { message: string }).message}` },
        { status: 500 }
      );
    }

    const rawText = await extractResourceText(file);
    const contentText = rawText ? sanitizeExtractedText(rawText) : "";
    const extractionStatus = getExtractionStatus(contentText, true);
    const indexingStatus = getIndexingStatus(contentText);

    const { data: resource, error: dbError } = await local
      .from("resources")
      .insert({
        user_id: user.id,
        title,
        type: getResourceType(file.type),
        mime_type: file.type,
        file_path: filePath,
        file_size: file.size,
        subject_id: subjectId || null,
        content_text: contentText || null,
        extraction_status: extractionStatus,
        indexing_status: indexingStatus,
        indexed_at: null,
        last_index_error: null,
        tags: ["chat_attachment"],
      })
      .select("id, title, type, file_path, file_size, created_at")
      .single();

    if (dbError || !resource) {
      await local.storage.from(RESOURCE_BUCKET).remove([filePath]);
      return NextResponse.json(
        { error: `Database error: ${dbError?.message ?? "Failed to create resource"}` },
        { status: 500 }
      );
    }

    if (contentText.length > 10) {
      await local
        .from("resources")
        .update({ indexing_status: "indexing", last_index_error: null })
        .eq("id", resource.id)
        .eq("user_id", user.id);

      fetch(new URL("/api/embeddings", request.url).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({
          source_type: "resource",
          source_id: resource.id,
          content_text: contentText,
          metadata: {
            title,
            file_type: file.type,
            uploaded_from: "chat_attachment",
          },
        }),
      }).catch(() => {
        // Embedding generation is best-effort; direct attachment grounding uses content_text immediately.
      });
    }

    return NextResponse.json({
      success: true,
      resource: {
        ...resource,
        has_text: contentText.length > 0,
        content_excerpt: contentText.slice(0, 500),
      },
    });
  } catch (err) {
    console.error("Chat attachment upload error:", err);
    return NextResponse.json(
      { error: "Attachment processing failed" },
      { status: 500 }
    );
  }
}
