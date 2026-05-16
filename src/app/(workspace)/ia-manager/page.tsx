import {
  IAManagerBoard,
  type IAItem,
} from "@/components/curriculum/curriculum-controls";
import { EmptyState } from "@/components/empty-state";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { createClient } from "@/lib/local/client";
import { ClipboardList } from "lucide-react";

type IASubject = { id: string; subject_name: string; level: string };

export default async function IAManagerPage() {
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const [iasResult, subjectsResult] = await Promise.all([
    local
      .from("internal_assessments")
      .select("*")
      .eq("user_id", user.id),
    local
      .from("user_subjects")
      .select("id, subject_name, level")
      .eq("user_id", user.id),
  ]);

  const ias = (iasResult.data ?? []) as IAItem[];
  const subjects = (subjectsResult.data ?? []) as IASubject[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline text-ink">IA Manager</h1>
        <p className="mt-1 text-body-sm text-ink-subtle">
          Track, edit, and move all {ias.length} Internal Assessments.
        </p>
      </div>

      {ias.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No IAs tracked"
          description="Internal Assessments are generated from your subjects during onboarding."
        />
      ) : (
        <IAManagerBoard ias={ias} subjects={subjects} />
      )}
    </div>
  );
}
