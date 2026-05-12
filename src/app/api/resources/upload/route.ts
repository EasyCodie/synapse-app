import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
];

const TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "other",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "other",
  "text/plain": "other",
  "text/markdown": "other",
};

async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  if (file.type === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const data = new Uint8Array(arrayBuffer);
      const parser = new PDFParse({ data });
      const result = await parser.getText();
      await parser.destroy();
      return result.text;
    } catch (err) {
      console.error("PDF extraction failed:", err);
      return "";
    }
  }

  if (file.type === "text/plain" || file.type === "text/markdown") {
    return Buffer.from(arrayBuffer).toString("utf-8");
  }

  // For DOCX/PPTX — extract raw text from XML inside the zip
  try {
    const { extractDocxText } = await import("@/lib/extract-docx");
    return await extractDocxText(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("DOCX extraction failed:", err);
    return "";
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (!ALLOWED_TYPES.includes(file.type)) {
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
    // 1. Upload to Supabase Storage
    // Sanitize filename: replace special chars with underscores, keep extension
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
    const filePath = `${user.id}/${Date.now()}-${sanitizedName}`;
    const { error: uploadError } = await supabase.storage
      .from("resources")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 2. Extract text content and sanitize for Postgres (remove null bytes)
    const rawText = await extractText(file);
    const contentText = rawText ? rawText.replace(/\u0000/g, "") : "";

    // 3. Insert resource record
    const { data: resource, error: dbError } = await supabase
      .from("resources")
      .insert({
        user_id: user.id,
        title,
        type: TYPE_MAP[file.type] ?? "other",
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
      await supabase.storage.from("resources").remove([filePath]);
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
