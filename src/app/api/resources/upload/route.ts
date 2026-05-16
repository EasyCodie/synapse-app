import { createClient } from "@/lib/local/client";
import {
  extractResourceText,
  getResourceType,
  isAllowedMimeType,
  RESOURCE_BUCKET,
  RESOURCE_LIBRARY_ALLOWED_MIME_TYPES,
  sanitizeExtractedText,
  sanitizeResourceFilename,
} from "@/lib/resource-upload";
import { NextResponse } from "next/server";

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
  const title = (formData.get("title") as string) || file?.name || "Untitled";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAllowedMimeType(file.type, RESOURCE_LIBRARY_ALLOWED_MIME_TYPES)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 50MB)" },
      { status: 400 }
    );
  }

  try {
    // 1. Store the original file in local app storage.
    // Sanitize filename: replace special chars with underscores, keep extension
    const sanitizedName = sanitizeResourceFilename(file.name);
    const filePath = `${user.id}/${Date.now()}-${sanitizedName}`;
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

    // 2. Extract text content and sanitize for Postgres (remove null bytes)
    const rawText = await extractResourceText(file);
    const contentText = rawText ? sanitizeExtractedText(rawText) : "";

    // 3. Insert resource record
    const { data: resource, error: dbError } = await local
      .from("resources")
      .insert({
        user_id: user.id,
        title,
        type: getResourceType(file.type),
        file_path: filePath,
        file_size: file.size,
        subject_id: subjectId || null,
        content_text: contentText || null,
        tags: [],
      })
      .select("id")
      .single();

    if (dbError) {
      // Cleanup storage on DB failure
      await local.storage.from(RESOURCE_BUCKET).remove([filePath]);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 4. Generate embeddings if we have text content
    if (contentText && contentText.length > 10 && resource) {
      // Fire and forget — don't block the response
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
          metadata: { title, file_type: file.type },
        }),
      }).catch(() => {
        // Embedding generation is best-effort
      });
    }

    return NextResponse.json({
      success: true,
      resource: { id: resource?.id, title, file_path: filePath },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload processing failed" },
      { status: 500 }
    );
  }
}
