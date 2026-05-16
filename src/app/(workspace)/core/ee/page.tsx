import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

export default async function EEPage() {
  const user = await requireUser();
  const local = await createClient();

  const { data: ee } = await local
    .from("ee_tracker")
    .select("id, title, subject, supervisor, word_count, status, milestones")
    .eq("user_id", user.id)
    .single();

  const milestones = [
    { id: "proposal", label: "Research Proposal", order: 1 },
    { id: "outline", label: "Essay Outline", order: 2 },
    { id: "first_draft", label: "First Draft", order: 3 },
    { id: "second_draft", label: "Second Draft", order: 4 },
    { id: "final", label: "Final Submission", order: 5 },
  ];

  const rawMilestones = ee?.milestones;
  const completedMilestones: string[] =
    Array.isArray(rawMilestones) ? (rawMilestones as string[]) : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/core" className="text-body-sm text-ink-subtle hover:text-ink transition-colors duration-200">The Core</Link>
          <span className="text-ink-tertiary">/</span>
          <span className="text-body-sm text-ink">Extended Essay</span>
        </div>
        <h1 className="text-headline text-ink">Extended Essay</h1>
        <p className="text-body-sm text-ink-subtle mt-1">4,000-word independent research paper</p>
      </div>

      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-caption text-ink-subtle mb-1">Title</p>
            <p className="text-body-sm text-ink">{ee?.title ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Subject</p>
            <p className="text-body-sm text-ink">{ee?.subject ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Supervisor</p>
            <p className="text-body-sm text-ink">{ee?.supervisor ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Status</p>
            <p className="text-body-sm text-ink capitalize">{ee?.status ?? "planning"}</p>
          </div>
        </div>

        {/* Word count */}
        <div>
          <div className="flex justify-between text-caption text-ink-subtle mb-1.5">
            <span>Word count</span>
            <span>{ee?.word_count ?? 0} / 4,000</span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(((ee?.word_count ?? 0) / 4000) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-surface-1 border border-hairline rounded-lg p-5">
        <h2 className="text-card-title text-ink mb-4">Milestones</h2>
        <div className="space-y-3">
          {milestones.map((m, idx) => {
            const done = completedMilestones.includes(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${done ? "bg-primary border-primary" : "border-hairline-strong"}`}>
                  {done ? (
                    <svg className="w-3 h-3 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-caption text-ink-tertiary">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-body-sm ${done ? "text-ink-subtle line-through" : "text-ink"}`}>
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
