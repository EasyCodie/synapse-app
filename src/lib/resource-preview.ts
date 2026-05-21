import type { createClient } from "@/lib/local/client";

type LocalClient = Awaited<ReturnType<typeof createClient>>;

const EXTRACTED_TEXT_PREVIEW_CHARS = 24000;

type RawResource = {
  id: string;
  title: string;
  type: string;
  tags?: string[] | null;
  subject_id?: string | null;
  created_at: string;
  file_size?: number | null;
  mime_type?: string | null;
  extraction_status?: string | null;
  indexing_status?: string | null;
  indexed_at?: string | null;
  last_index_error?: string | null;
  source_url?: string | null;
  content_text?: string | null;
  file_path?: string | null;
};

type RawSubject = {
  id: string;
  subject_name: string;
  level?: string | null;
};

type RawEmbedding = {
  id: string;
  chunk_index?: number | null;
  content_text?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type ResourcePreviewChunk = {
  id: string;
  chunk_index: number | null;
  content_text: string;
  word_start: number | null;
  word_end: number | null;
  heading: string | null;
  page_label: string | null;
  slide_label: string | null;
};

export type ResourcePreviewData = {
  resource: {
    id: string;
    title: string;
    type: string;
    tags: string[];
    subject_id: string | null;
    subject_name: string | null;
    subject_level: string | null;
    created_at: string;
    file_size: number | null;
    mime_type: string | null;
    extraction_status: string | null;
    indexing_status: string | null;
    indexed_at: string | null;
    last_index_error: string | null;
    source_url: string | null;
    has_original_file: boolean;
    extracted_text_preview: string;
    extracted_text_char_count: number;
    extracted_text_truncated: boolean;
  };
  chunks: ResourcePreviewChunk[];
};

function metadataNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeChunk(row: RawEmbedding): ResourcePreviewChunk {
  const metadata = row.metadata ?? {};
  const chunkIndex =
    typeof row.chunk_index === "number"
      ? row.chunk_index
      : metadataNumber(metadata, "chunk_index");

  return {
    id: row.id,
    chunk_index: chunkIndex,
    content_text: row.content_text ?? "",
    word_start: metadataNumber(metadata, "word_start"),
    word_end: metadataNumber(metadata, "word_end"),
    heading: metadataString(metadata, "heading"),
    page_label: metadataString(metadata, "page_label"),
    slide_label: metadataString(metadata, "slide_label"),
  };
}

export async function getResourcePreview(
  local: LocalClient,
  userId: string,
  resourceId: string,
): Promise<ResourcePreviewData | null> {
  const { data: resource, error } = await local
    .from("resources")
    .select(
      "id, title, type, tags, subject_id, created_at, file_size, mime_type, extraction_status, indexing_status, indexed_at, last_index_error, source_url, content_text, file_path",
    )
    .eq("id", resourceId)
    .eq("user_id", userId)
    .single();

  if (error || !resource) return null;

  const typedResource = resource as RawResource;
  let subject: RawSubject | null = null;

  if (typedResource.subject_id) {
    const { data } = await local
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("id", typedResource.subject_id)
      .eq("user_id", userId)
      .maybeSingle();
    subject = (data as RawSubject | null) ?? null;
  }

  const { data: embeddings } = await local
    .from("embeddings")
    .select("id, chunk_index, content_text, metadata, created_at")
    .eq("user_id", userId)
    .eq("source_type", "resource")
    .eq("source_id", resourceId)
    .order("chunk_index", { ascending: true });

  const contentText = typedResource.content_text ?? "";
  const preview = contentText.slice(0, EXTRACTED_TEXT_PREVIEW_CHARS);

  return {
    resource: {
      id: typedResource.id,
      title: typedResource.title,
      type: typedResource.type,
      tags: Array.isArray(typedResource.tags) ? typedResource.tags : [],
      subject_id: typedResource.subject_id ?? null,
      subject_name: subject?.subject_name ?? null,
      subject_level: subject?.level ?? null,
      created_at: typedResource.created_at,
      file_size: typedResource.file_size ?? null,
      mime_type: typedResource.mime_type ?? null,
      extraction_status: typedResource.extraction_status ?? null,
      indexing_status: typedResource.indexing_status ?? null,
      indexed_at: typedResource.indexed_at ?? null,
      last_index_error: typedResource.last_index_error ?? null,
      source_url: typedResource.source_url ?? null,
      has_original_file: Boolean(typedResource.file_path),
      extracted_text_preview: preview,
      extracted_text_char_count: contentText.length,
      extracted_text_truncated: contentText.length > preview.length,
    },
    chunks: ((embeddings ?? []) as RawEmbedding[]).map(normalizeChunk),
  };
}
