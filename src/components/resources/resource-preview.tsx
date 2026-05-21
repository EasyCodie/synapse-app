import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Hash,
} from "lucide-react";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";
import { ReindexResourceButton } from "@/components/resources/reindex-resource-button";
import type {
  ResourcePreviewChunk,
  ResourcePreviewData,
} from "@/lib/resource-preview";
import { cn } from "@/lib/utils";
import { displaySubjectName } from "@/lib/subject-display";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
  txt: "TXT",
  md: "Markdown",
  web_clip: "Document",
  scan: "Document",
  image: "Document",
  other: "Document",
};

export function ResourcePreview({
  preview,
  selectedChunkIndex,
}: {
  preview: ResourcePreviewData;
  selectedChunkIndex?: number | null;
}) {
  const { resource, chunks } = preview;
  const indexStatus = resource.indexing_status ?? "not_started";
  const extractionStatus = resource.extraction_status ?? "not_started";
  const typeLabel = TYPE_LABELS[resource.type] ?? "Document";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/resources"
            className="mb-3 inline-flex items-center gap-2 text-caption text-ink-subtle transition-colors duration-200 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Resource Library
          </Link>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-2 text-caption font-semibold text-ink-subtle">
              {typeLabel.slice(0, 3).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-headline text-ink">{resource.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-tertiary">
                <span>{typeLabel}</span>
                {resource.subject_name && (
                  <>
                    <span>/</span>
                    <span className="text-ink-subtle">
                      {displaySubjectName(resource.subject_name)}
                      {resource.subject_level ? ` ${resource.subject_level}` : ""}
                    </span>
                  </>
                )}
                {resource.file_size !== null && (
                  <>
                    <span>/</span>
                    <span>{formatBytes(resource.file_size)}</span>
                  </>
                )}
                <span>/</span>
                <span>{formatDate(resource.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {resource.source_url && (
            <a
              href={resource.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2.5 text-button text-ink transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Source
            </a>
          )}
          {resource.has_original_file && (
            <a
              href={`/api/resources/${resource.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2.5 text-button text-ink transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2"
            >
              <Download className="h-3.5 w-3.5" />
              Original
            </a>
          )}
          <div className="flex items-center gap-1 rounded-md border border-hairline bg-surface-2/50 p-0.5">
            <ReindexResourceButton resourceId={resource.id} />
            <DeleteResourceButton resourceId={resource.id} redirectTo="/resources" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-6">
          <section className="rounded-lg border border-hairline bg-surface-1 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-card-title text-ink">Extracted Text</h2>
                <p className="text-caption text-ink-tertiary">
                  {resource.extracted_text_char_count.toLocaleString()} characters
                </p>
              </div>
              <StatusPill status={extractionStatus} />
            </div>
            {resource.extracted_text_preview ? (
              <>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-hairline bg-canvas p-4 text-caption leading-relaxed text-ink-muted">
                  {resource.extracted_text_preview}
                </pre>
                {resource.extracted_text_truncated && (
                  <p className="mt-2 text-caption text-ink-tertiary">
                    Preview truncated to keep the workspace responsive.
                  </p>
                )}
              </>
            ) : (
              <EmptyPanel
                icon={FileText}
                title="No extracted text"
                description="Reindex this resource after confirming the original file contains selectable text."
              />
            )}
          </section>

          <section className="rounded-lg border border-hairline bg-surface-1 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-card-title text-ink">Search Chunks</h2>
                <p className="text-caption text-ink-tertiary">
                  {chunks.length} chunk{chunks.length === 1 ? "" : "s"} indexed
                </p>
              </div>
              <StatusPill status={indexStatus} />
            </div>
            {chunks.length > 0 ? (
              <div className="space-y-2">
                {chunks.map((chunk) => (
                  <ChunkSnippet
                    key={chunk.id}
                    chunk={chunk}
                    selected={selectedChunkIndex === chunk.chunk_index}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel
                icon={Hash}
                title="No chunks indexed"
                description="Run reindex after extraction succeeds to make this resource available to search and Advisor."
              />
            )}
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border border-hairline bg-surface-1 p-5">
            <h2 className="text-body-sm font-medium text-ink">Metadata</h2>
            <dl className="mt-4 space-y-3 text-caption">
              <MetadataRow label="Type" value={typeLabel} />
              <MetadataRow label="MIME" value={resource.mime_type ?? "Unknown"} />
              <MetadataRow label="Extraction" value={formatStatus(extractionStatus)} />
              <MetadataRow label="Indexing" value={formatStatus(indexStatus)} />
              <MetadataRow
                label="Indexed"
                value={resource.indexed_at ? formatDate(resource.indexed_at) : "Never"}
              />
              <MetadataRow
                label="Original"
                value={resource.has_original_file ? "Available" : "Unavailable"}
              />
            </dl>
            {resource.last_index_error && (
              <div className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-caption text-ink-subtle">
                <div className="mb-1 flex items-center gap-1.5 text-ink-muted">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Indexing error
                </div>
                {resource.last_index_error}
              </div>
            )}
          </section>

          {resource.tags.length > 0 && (
            <section className="rounded-lg border border-hairline bg-surface-1 p-5">
              <h2 className="text-body-sm font-medium text-ink">Tags</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {resource.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-hairline bg-surface-2 px-2 py-1 text-caption text-ink-subtle"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function ChunkSnippet({
  chunk,
  selected,
}: {
  chunk: ResourcePreviewChunk;
  selected: boolean;
}) {
  const chunkNumber =
    typeof chunk.chunk_index === "number" ? chunk.chunk_index + 1 : null;
  const locations = [
    chunk.heading,
    chunk.page_label,
    chunk.slide_label,
    chunk.word_start !== null && chunk.word_end !== null
      ? `Words ${chunk.word_start + 1}-${chunk.word_end + 1}`
      : null,
  ].filter(Boolean);

  return (
    <article
      id={typeof chunk.chunk_index === "number" ? `chunk-${chunk.chunk_index}` : undefined}
      className={cn(
        "scroll-mt-6 rounded-lg border p-4 transition-colors duration-200",
        selected
          ? "border-primary/60 bg-primary/5"
          : "border-hairline bg-canvas",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-2 px-2 py-1 text-caption text-ink-subtle">
          <Hash className="h-3 w-3" />
          {chunkNumber ? `Chunk ${chunkNumber}` : "Chunk"}
        </span>
        {locations.map((location) => (
          <span key={location} className="text-caption text-ink-tertiary">
            {location}
          </span>
        ))}
      </div>
      <p className="line-clamp-4 text-body-sm leading-relaxed text-ink-muted">
        {chunk.content_text}
      </p>
    </article>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className="min-w-0 text-right text-ink-subtle">{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "indexed" || status === "extracted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-caption",
        ok
          ? "border-semantic-success/25 bg-semantic-success/10 text-semantic-success"
          : "border-hairline bg-surface-2 text-ink-subtle",
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {formatStatus(status)}
    </span>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas p-5 text-center">
      <Icon className="mx-auto h-5 w-5 text-ink-tertiary" />
      <p className="mt-2 text-body-sm text-ink-muted">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-caption text-ink-tertiary">
        {description}
      </p>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
