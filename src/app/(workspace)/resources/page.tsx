import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { Library } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { UploadResource } from "@/components/resources/upload-resource";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";
import { ReindexResourceButton } from "@/components/resources/reindex-resource-button";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
  txt: "TXT",
  md: "MD",
  web_clip: "Document",
  scan: "Document",
  image: "Document",
  other: "Document",
};

const DOCUMENT_BADGE_CLASS =
  "border border-hairline bg-surface-2 text-ink-subtle";

type ResourceItem = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  subject_id: string | null;
  created_at: string;
  file_size: number | null;
  extraction_status?: string | null;
  indexing_status?: string | null;
  last_index_error?: string | null;
};
type ResourceSubject = { id: string; subject_name: string };
type IndexedResource = { source_id: string };

export default async function ResourcesPage() {
  const user = await requireUser();
  const local = await createClient();

  const [resourcesResult, subjectsResult, driveStatus] = await Promise.all([
    local
      .from("resources")
      .select(
        "id, title, type, tags, subject_id, created_at, file_size, extraction_status, indexing_status, last_index_error",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    local
      .from("user_subjects")
      .select("id, subject_name")
      .eq("user_id", user.id),
    getGoogleDriveStatus(user.id),
  ]);

  const resources = (resourcesResult.data ?? []) as ResourceItem[];
  const subjects = (subjectsResult.data ?? []) as ResourceSubject[];
  const subjectMap = Object.fromEntries(
    subjects.map((s) => [s.id, s.subject_name]),
  );

  const resourceIds = resources.map((resource) => resource.id);
  const { data: indexedResources } =
    resourceIds.length > 0
      ? await local
          .from("embeddings")
          .select("source_id")
          .eq("user_id", user.id)
          .eq("source_type", "resource")
          .in("source_id", resourceIds)
      : { data: [] };

  const indexedIds = new Set(
    ((indexedResources ?? []) as IndexedResource[]).map((e) => e.source_id),
  );

  const indexedCount = resources.filter((r) => indexedIds.has(r.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline text-ink">Resource Library</h1>
          <p className="text-body-sm text-ink-subtle mt-1">
            {resources.length} resource{resources.length !== 1 ? "s" : ""}
            {resources.length > 0 && (
              <span className="text-ink-tertiary">
                {" "}
                · {indexedCount} indexed for resource search
              </span>
            )}
          </p>
        </div>
        <UploadResource subjects={subjects} driveStatus={driveStatus} />
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No resources yet"
          description="Upload PDFs, documents, and notes to build your resource library. Text is automatically extracted for search and Advisor context."
        />
      ) : (
        <div className="space-y-2">
          {resources.map((resource, i) => {
            const isIndexed = indexedIds.has(resource.id);
            const indexStatus = isIndexed
              ? "indexed"
              : (resource.indexing_status ?? "not_started");
            const extractionStatus = resource.extraction_status ?? "extracted";
            return (
              <div
                key={resource.id}
                className="group flex items-center gap-4 px-5 py-4 bg-surface-1 border border-hairline rounded-lg hover:border-hairline-strong transition-all duration-200"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* File type badge */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${DOCUMENT_BADGE_CLASS}`}
                >
                  <span className="text-caption font-semibold">
                    {(TYPE_LABELS[resource.type] ?? "Document")
                      .slice(0, 3)
                      .toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-ink truncate">
                    {resource.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-caption text-ink-tertiary">
                      {TYPE_LABELS[resource.type] ?? "Document"}
                    </span>
                    {resource.subject_id && subjectMap[resource.subject_id] && (
                      <>
                        <span className="text-ink-tertiary">·</span>
                        <span className="text-caption text-ink-subtle">
                          {subjectMap[resource.subject_id]}
                        </span>
                      </>
                    )}
                    {resource.file_size && (
                      <>
                        <span className="text-ink-tertiary">·</span>
                        <span className="text-caption text-ink-tertiary">
                          {formatBytes(resource.file_size as number)}
                        </span>
                      </>
                    )}
                    {/* Indexed status */}
                    <span className="text-ink-tertiary">·</span>
                    <span
                      className={`text-caption ${indexStatus === "indexed" ? "text-semantic-success" : indexStatus === "failed" ? "text-destructive" : "text-ink-tertiary"}`}
                    >
                      {formatStatus(indexStatus)}
                    </span>
                    {extractionStatus !== "extracted" && (
                      <>
                        <span className="text-ink-tertiary">Â·</span>
                        <span className="text-caption text-ink-tertiary">
                          {formatStatus(extractionStatus)}
                        </span>
                      </>
                    )}
                  </div>
                  {resource.last_index_error && (
                    <p className="mt-1 truncate text-caption text-ink-tertiary">
                      {resource.last_index_error}
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div className="hidden sm:flex gap-1.5 shrink-0">
                  {(resource.tags as string[])
                    .slice(0, 2)
                    .map((tag: string) => (
                      <span
                        key={tag}
                        className="text-caption px-2 py-0.5 bg-surface-2 text-ink-subtle rounded"
                      >
                        {tag}
                      </span>
                    ))}
                </div>

                {/* Date */}
                <span className="text-caption text-ink-tertiary shrink-0 tabular-nums hidden md:inline">
                  {formatRelativeDate(resource.created_at)}
                </span>

                {/* Delete — revealed on hover */}
                <div className="flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-surface-2/50 p-0.5">
                  <ReindexResourceButton resourceId={resource.id} />
                  <DeleteResourceButton resourceId={resource.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
