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

type ResourceType = "pdf" | "web_clip" | "scan" | "image" | "other";

export function getResourceType(mimeType: string): ResourceType {
  return mimeType === "application/pdf" ? "pdf" : "other";
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

export async function extractResourceText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  if (file.type === "application/pdf") {
    try {
      const { extractPdfText } = await import("@/lib/extract-pdf");
      return await extractPdfText(arrayBuffer);
    } catch (err) {
      console.error("PDF extraction failed:", err);
      return "";
    }
  }

  if (file.type === "text/plain" || file.type === "text/markdown") {
    return Buffer.from(arrayBuffer).toString("utf-8");
  }

  try {
    const { extractDocxText } = await import("@/lib/extract-docx");
    return await extractDocxText(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Document extraction failed:", err);
    return "";
  }
}
