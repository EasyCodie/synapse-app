import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { Library } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { UploadResource } from "@/components/resources/upload-resource";
import { DeleteResourceButton } from "@/components/resources/delete-resource-button";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  web_clip: "Web clip",
  scan: "Scan",
  image: "Image",
  other: "Other",
};

export default async function ResourcesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [resourcesResult, subjectsResult] = await Promise.all([
    supabase
      .from("resources")
      .select("id, title, type, tags, subject_id, created_at, file_size, url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_subjects")
      .select("id, subject_name")
      .eq("user_id", user.id),
  ]);

  const resources = resourcesResult.data ?? [];
  const subjects = subjectsResult.data ?? [];
  const subjectMap = Object.fromEntries(
    subjects.map((s) => [s.id, s.subject_name])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline text-ink">Resource Library</h1>
          <p className="text-body-sm text-ink-subtle mt-1">
            {resources.length} resource{resources.length !== 1 ? "s" : ""}
          </p>
        </div>
        <UploadResource subjects={subjects as Array<{ id: string; subject_name: string }>} />
      </div>

      {resources.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No resources yet"
          description="Upload PDFs, documents, and notes to build your resource library. Text is automatically extracted for AI search."
        />
      ) : (
        <div className="space-y-2">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center gap-4 px-5 py-4 bg-surface-1 border border-hairline rounded-lg hover:border-hairline-strong transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-md bg-surface-3 flex items-center justify-center shrink-0">
                <ResourceIcon type={resource.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-ink truncate">
                  {resource.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-caption text-ink-subtle">
                    {TYPE_LABELS[resource.type] ?? resource.type}
                  </span>
                  {resource.subject_id && subjectMap[resource.subject_id] && (
                    <>
                      <span className="text-ink-subtle">·</span>
                      <span className="text-caption text-ink-subtle">
                        {subjectMap[resource.subject_id]}
                      </span>
                    </>
                  )}
                  {resource.file_size && (
                    <>
                      <span className="text-ink-subtle">·</span>
                      <span className="text-caption text-ink-subtle">
                        {formatBytes(resource.file_size as number)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {(resource.tags as string[]).slice(0, 2).map((tag: string) => (
                  <span
                    key={tag}
                    className="text-caption px-2 py-0.5 bg-surface-3 text-ink-subtle rounded-pill"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-caption text-ink-subtle shrink-0">
                {new Date(resource.created_at).toLocaleDateString()}
              </span>
              <DeleteResourceButton resourceId={resource.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    pdf: "PDF",
    web_clip: "WEB",
    scan: "SCN",
    image: "IMG",
    other: "DOC",
  };
  return (
    <span className="text-caption font-medium text-ink-subtle">
      {icons[type] ?? "DOC"}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
