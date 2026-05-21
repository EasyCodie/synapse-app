import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/local/client";
import { getResourcePreview } from "@/lib/resource-preview";
import { ResourcePreview } from "@/components/resources/resource-preview";

type ResourcePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chunk?: string | string[] }>;
};

export default async function ResourcePage({
  params,
  searchParams,
}: ResourcePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const local = await createClient();
  const preview = await getResourcePreview(local, user.id, id);

  if (!preview) notFound();

  const rawChunk = Array.isArray(query.chunk) ? query.chunk[0] : query.chunk;
  const selectedChunkIndex =
    typeof rawChunk === "string" && rawChunk.trim()
      ? Number.parseInt(rawChunk, 10)
      : null;

  return (
    <ResourcePreview
      preview={preview}
      selectedChunkIndex={
        Number.isFinite(selectedChunkIndex) ? selectedChunkIndex : null
      }
    />
  );
}
