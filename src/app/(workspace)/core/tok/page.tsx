import Link from "next/link";
import {
  TOKEditor,
  type CurriculumDocumentItem,
} from "@/components/curriculum/curriculum-controls";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

export default async function TOKPage() {
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const [tokResult, documentsResult, driveStatus] = await Promise.all([
    local.from("tok_tracker").select("*").eq("user_id", user.id).single(),
    local
      .from("curriculum_documents")
      .select("*")
      .eq("user_id", user.id)
      .eq("owner_type", "tok")
      .order("created_at", { ascending: false }),
    getGoogleDriveStatus(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Link
            href="/core"
            className="text-body-sm text-ink-subtle transition-colors duration-200 hover:text-ink"
          >
            The Core
          </Link>
          <span className="text-ink-tertiary">/</span>
          <span className="text-body-sm text-ink">Theory of Knowledge</span>
        </div>
        <h1 className="text-headline text-ink">Theory of Knowledge</h1>
        <p className="mt-1 text-body-sm text-ink-subtle">
          Manage the essay title and the three exhibition objects in one place.
        </p>
      </div>

      {tokResult.data && (
        <TOKEditor
          tok={tokResult.data}
          documents={(documentsResult.data ?? []) as CurriculumDocumentItem[]}
          driveStatus={driveStatus}
        />
      )}
    </div>
  );
}
