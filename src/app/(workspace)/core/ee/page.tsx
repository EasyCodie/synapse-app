import Link from "next/link";
import {
  EEEditor,
  type CurriculumDocumentItem,
} from "@/components/curriculum/curriculum-controls";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { getGoogleDriveStatus } from "@/lib/google-drive";
import { createClient } from "@/lib/local/client";

export default async function EEPage() {
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const [eeResult, documentsResult, driveStatus] = await Promise.all([
    local.from("ee_tracker").select("*").eq("user_id", user.id).single(),
    local
      .from("curriculum_documents")
      .select("*")
      .eq("user_id", user.id)
      .eq("owner_type", "ee")
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
          <span className="text-body-sm text-ink">Extended Essay</span>
        </div>
        <h1 className="text-headline text-ink">Extended Essay</h1>
        <p className="mt-1 text-body-sm text-ink-subtle">
          Plan the 4,000-word research project, track milestones, and keep the
          working question visible.
        </p>
      </div>

      {eeResult.data && (
        <EEEditor
          ee={eeResult.data}
          documents={(documentsResult.data ?? []) as CurriculumDocumentItem[]}
          driveStatus={driveStatus}
        />
      )}
    </div>
  );
}
