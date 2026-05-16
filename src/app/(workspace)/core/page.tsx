import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { AnimatedList, AnimatedItem } from "@/components/layout/animated-list";

export default async function CorePage() {
  const user = await requireUser();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline text-ink">The Core</h1>
        <p className="text-body-sm text-ink-subtle mt-1">
          Extended Essay, Theory of Knowledge, and CAS
        </p>
      </div>

      <AnimatedList className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coreModules.map((mod) => (
          <AnimatedItem key={mod.href}>
            <Link
              href={mod.href}
              className="block bg-surface-1 border border-hairline rounded-lg p-6 hover:border-hairline-strong hover:bg-surface-2 transition-all duration-200 group space-y-3"
            >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-caption font-semibold text-primary">{mod.abbr}</span>
              </div>
              {mod.status && <CoreStatusBadge status={mod.status} />}
            </div>
            <div>
              <h3 className="text-card-title text-ink">{mod.label}</h3>
              <p className="text-body-sm text-ink-subtle mt-1">{mod.description}</p>
              {mod.detail && (
                <p className="text-caption text-ink-subtle mt-1 truncate">{mod.detail}</p>
              )}
            </div>
            {mod.wordCount !== null && mod.wordTarget !== null && (
              <div>
                <div className="flex justify-between text-caption text-ink-subtle mb-1">
                  <span>Word count</span>
                  <span>{mod.wordCount} / {mod.wordTarget}</span>
                </div>
                <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min((mod.wordCount / mod.wordTarget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
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
