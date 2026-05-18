import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { createClient } from "@/lib/local/client";
import { ensureRoadmapForUser } from "@/lib/roadmap";
import type { RoadmapSubject } from "@/lib/roadmap-types";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const user = await requireUser();
  const local = await createClient();

  await ensureCurriculumScaffold(user.id);
  const [{ items, insight }, subjectsResult] = await Promise.all([
    ensureRoadmapForUser(user.id, { localClient: local }),
    local
      .from("user_subjects")
      .select("id, subject_name, level, subject_group")
      .eq("user_id", user.id)
      .order("subject_group"),
  ]);

  return (
    <RoadmapView
      initialItems={items}
      initialInsight={insight}
      subjects={(subjectsResult.data ?? []) as RoadmapSubject[]}
    />
  );
}
