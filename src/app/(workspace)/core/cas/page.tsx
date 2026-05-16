import Link from "next/link";
import {
  CASEditor,
  type CASExperience,
} from "@/components/curriculum/curriculum-controls";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import { createClient } from "@/lib/local/client";

export default async function CASPage() {
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const { data } = await local
    .from("cas_experiences")
    .select("id, title, type, description, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const cas = (data ?? []) as CASExperience[];

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
          <span className="text-body-sm text-ink">CAS</span>
        </div>
        <h1 className="text-headline text-ink">Creativity, Activity, Service</h1>
        <p className="mt-1 text-body-sm text-ink-subtle">
          Log experiences, update progress, and keep reflection notes close to
          the programme requirements.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["creativity", "activity", "service"] as const).map((type) => (
          <div
            key={type}
            className="rounded-lg border border-hairline bg-surface-1 p-4 text-center"
          >
            <p className="text-headline text-primary">
              {cas.filter((experience) => experience.type === type).length}
            </p>
            <p className="mt-1 text-caption capitalize text-ink-subtle">{type}</p>
          </div>
        ))}
      </div>

      <CASEditor experiences={cas} />
    </div>
  );
}
