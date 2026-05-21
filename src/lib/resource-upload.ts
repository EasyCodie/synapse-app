export const RESOURCE_BUCKET = "resources";

export const RESOURCE_LIBRARY_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
] as const;

export const CHAT_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

type ResourceType =
  | "pdf"
  | "docx"
  | "pptx"
  | "txt"
  | "md"
  | "web_clip"
  | "scan"
  | "image"
  | "other";
export type ExtractionStatus = "extracted" | "failed" | "no_text";
export type IndexingStatus = "queued" | "indexing" | "indexed" | "failed" | "not_started";

export function getResourceType(mimeType: string): ResourceType {
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "pptx";
  }
  if (mimeType === "text/markdown") return "md";
  if (mimeType === "text/plain") return "txt";
  return "other";
}

export function inferResourceMimeType(resource: {
  mime_type?: string | null;
  type?: string | null;
  file_path?: string | null;
}) {
  if (resource.mime_type) return resource.mime_type;
  if (resource.type === "pdf" || resource.file_path?.toLowerCase().endsWith(".pdf")) {
    return "application/pdf";
  }
  if (resource.type === "docx" || resource.file_path?.toLowerCase().endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (resource.type === "pptx" || resource.file_path?.toLowerCase().endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (resource.type === "md" || resource.file_path?.toLowerCase().endsWith(".md")) {
    return "text/markdown";
  }
  if (resource.type === "txt" || resource.file_path?.toLowerCase().endsWith(".txt")) {
    return "text/plain";
  }
  return "application/octet-stream";
}

export function isAllowedMimeType(mimeType: string, allowedTypes: readonly string[]) {
  return allowedTypes.includes(mimeType);
}

export function sanitizeResourceFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

export function sanitizeExtractedText(text: string) {
  return text.replace(/\u0000/g, "").trim();
}

export function getExtractionStatus(contentText: string, attempted: boolean): ExtractionStatus {
  if (contentText.length > 0) return "extracted";
  return attempted ? "no_text" : "failed";
}

export function getIndexingStatus(contentText: string): IndexingStatus {
  return contentText.length > 10 ? "queued" : "not_started";
}

export async function extractResourceTextFromBuffer(
  arrayBuffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const { extractPdfText } = await import("@/lib/extract-pdf");
      return await extractPdfText(arrayBuffer);
    } catch (err) {
      console.error("PDF extraction failed:", err);
      return "";
    }
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return Buffer.from(arrayBuffer).toString("utf-8");
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    try {
      const { extractDocxText } = await import("@/lib/extract-docx");
      return await extractDocxText(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error("Document extraction failed:", err);
      return "";
    }
  }

  return "";
}

export async function extractResourceText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return extractResourceTextFromBuffer(arrayBuffer, file.type);
}
