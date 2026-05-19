import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import { ensureCurriculumScaffold } from "@/lib/curriculum";
import Link from "next/link";
import { AnimatedList, AnimatedItem } from "@/components/layout/animated-list";
import { ArrowRight } from "lucide-react";

export default async function CorePage() {
  const user = await requireUser();
  await ensureCurriculumScaffold(user.id);
  const local = await createClient();

  const [eeResult, tokResult, casResult] = await Promise.all([
    local.from("ee_tracker").select("id, title, status, word_count").eq("user_id", user.id).single(),
    local.from("tok_tracker").select("id, essay_title, status").eq("user_id", user.id).single(),
    local.from("cas_experiences").select("id, title, type, status").eq("user_id", user.id),
  ]);

  const ee = eeResult.data;
  const tok = tokResult.data;
  const cas = casResult.data ?? [];

  const coreModules = [
    {
      href: "/core/ee",
      label: "Extended Essay",
      abbr: "EE",
      description: "4,000-word independent research paper",
      status: ee?.status ?? null,
      detail: ee?.title ?? null,
      wordCount: ee?.word_count ?? null,
      wordTarget: 4000,
    },
    {
      href: "/core/tok",
      label: "Theory of Knowledge",
      abbr: "TOK",
      description: "Essay + Exhibition on knowledge questions",
      status: tok?.status ?? null,
      detail: tok?.essay_title ?? null,
      wordCount: null,
      wordTarget: null,
    },
    {
      href: "/core/cas",
      label: "Creativity, Activity, Service",
      abbr: "CAS",
      description: `${cas.length} experience${cas.length !== 1 ? "s" : ""} logged`,
      status: cas.length > 0 ? "in_progress" : null,
      detail: null,
      wordCount: null,
      wordTarget: null,
    },
  ];
  const currentModule =
    coreModules.find((mod) => mod.status === "in_progress" || mod.status === "planning") ??
    coreModules[0];
  const secondaryModules = coreModules.filter(
    (mod) => mod.href !== currentModule.href,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline text-ink">The Core</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          Extended Essay, Theory of Knowledge, and CAS
        </p>
      </div>

      <Link
        href={currentModule.href}
        className="group block rounded-lg border border-hairline-strong bg-surface-1 p-5 transition-colors duration-200 hover:bg-surface-2"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10">
              <span className="text-caption font-semibold text-primary">
                {currentModule.abbr}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-caption text-ink-tertiary">Current focus</p>
              <h2 className="mt-1 text-card-title text-ink">
                {currentModule.label}
              </h2>
              <p className="mt-1 text-body-sm text-ink-subtle">
                {currentModule.detail ?? currentModule.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentModule.status && (
              <CoreStatusBadge status={currentModule.status} />
            )}
            <ArrowRight className="h-4 w-4 text-ink-tertiary transition-colors group-hover:text-ink" />
          </div>
        </div>
        {currentModule.wordCount !== null && currentModule.wordTarget !== null && (
          <div className="mt-5 max-w-xl">
            <div className="mb-1 flex justify-between text-caption text-ink-subtle">
              <span>Word count</span>
              <span>
                {currentModule.wordCount} / {currentModule.wordTarget}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${Math.min(
                    (currentModule.wordCount / currentModule.wordTarget) * 100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
      </Link>

      <AnimatedList className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {secondaryModules.map((mod) => (
          <AnimatedItem key={mod.href}>
            <Link
              href={mod.href}
              className="group flex min-h-[96px] items-start justify-between gap-4 rounded-lg border border-hairline bg-surface-1 p-4 transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 text-caption font-medium text-ink-subtle">
                    {mod.abbr}
                  </span>
                  {mod.status && <CoreStatusBadge status={mod.status} />}
                </div>
                <h3 className="text-body-sm font-medium text-ink">
                  {mod.label}
                </h3>
                <p className="mt-1 truncate text-caption text-ink-subtle">
                  {mod.detail ?? mod.description}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-tertiary transition-colors group-hover:text-ink" />
            </Link>
          </AnimatedItem>
        ))}
      </AnimatedList>
    </div>
  );
}

function CoreStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    planning: { label: "Planning", className: "bg-surface-3 text-ink-subtle" },
    in_progress: { label: "In progress", className: "bg-primary/10 text-primary" },
    submitted: { label: "Submitted", className: "bg-semantic-success/20 text-semantic-success" },
  };
  const s = map[status] ?? { label: status, className: "bg-surface-3 text-ink-subtle" };
  return (
    <span className={`text-caption px-2 py-0.5 rounded-pill ${s.className}`}>
      {s.label}
    </span>
  );
}
