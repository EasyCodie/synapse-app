import { NextResponse } from "next/server";
import {
  getGoogleDocumentResourceSnapshot,
  parseGoogleDocumentId,
} from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";
import {
  getExtractionStatus,
  getIndexingStatus,
  getResourceType,
  RESOURCE_BUCKET,
  sanitizeExtractedText,
  sanitizeResourceFilename,
} from "@/lib/resource-upload";

const GOOGLE_DOC_MIME_TYPE = "text/plain";
const MAX_RESOURCE_BYTES = 50 * 1024 * 1024;

function cleanOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const documentUrl = cleanOptionalString(body.document_url, 2000);
  const subjectId = cleanOptionalString(body.subject_id, 100);
  const requestedTitle = cleanOptionalString(body.title, 200);
  const documentId = parseGoogleDocumentId(documentUrl);

  if (!documentId) {
    return NextResponse.json(
      { error: "Paste a valid Google Docs URL" },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getGoogleDocumentResourceSnapshot(
      user.id,
      documentId,
    );
    const title = requestedTitle || snapshot.title;
    const contentText = sanitizeExtractedText(snapshot.contentText);
    const fileText = contentText
      ? `${contentText}\n\nSource: ${snapshot.documentUrl}\n`
      : `Source: ${snapshot.documentUrl}\n`;
    const file = new Blob([fileText], { type: GOOGLE_DOC_MIME_TYPE });

    if (file.size > MAX_RESOURCE_BYTES) {
      return NextResponse.json(
        { error: "Imported document is too large (max 50MB)" },
        { status: 400 },
      );
    }

    const safeTitle = sanitizeResourceFilename(title || "google-document");
    const filePath = `${user.id}/${Date.now()}-${safeTitle}.txt`;
    const { error: uploadError } = await local.storage
      .from(RESOURCE_BUCKET)
      .upload(filePath, file, {
        contentType: GOOGLE_DOC_MIME_TYPE,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Import failed: Could not store imported Google Doc" },
        { status: 500 },
      );
    }

    const extractionStatus = getExtractionStatus(contentText, true);
    const indexingStatus = getIndexingStatus(contentText);
    const warnings: string[] = [];

    if (extractionStatus === "no_text") {
      warnings.push("No extractable text was found in this Google Doc.");
    }

    const { data: resource, error: dbError } = await local
      .from("resources")
      .insert({
        user_id: user.id,
        title,
        type: getResourceType(GOOGLE_DOC_MIME_TYPE),
        mime_type: GOOGLE_DOC_MIME_TYPE,
        file_path: filePath,
        file_size: file.size,
        subject_id: subjectId || null,
        content_text: contentText || null,
        extraction_status: extractionStatus,
        indexing_status: indexingStatus,
        indexed_at: null,
        last_index_error: null,
        source_url: snapshot.documentUrl,
        tags: ["google-doc"],
      })
      .select("id")
      .single();

    if (dbError) {
      await local.storage.from(RESOURCE_BUCKET).remove([filePath]);
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 },
      );
    }

    if (contentText.length > 10 && resource) {
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
            file_type: GOOGLE_DOC_MIME_TYPE,
            source_url: snapshot.documentUrl,
          },
        }),
      }).catch(() => {
        // Embedding generation is best-effort.
      });
    }

    return NextResponse.json({
      success: true,
      resource: { id: resource?.id, title, file_path: filePath },
      extraction_status: extractionStatus,
      indexing_status: contentText.length > 10 ? "indexing" : indexingStatus,
      content_length: contentText.length,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not import Google document",
      },
      { status: 500 },
    );
  }
}
