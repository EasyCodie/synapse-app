import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import type { Database } from "@/types/database";

type CASExperience = Pick<
  Database["public"]["Tables"]["cas_experiences"]["Row"],
  "id" | "title" | "type" | "description" | "status" | "created_at"
>;

export default async function CASPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("cas_experiences")
    .select("id, title, type, description, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const cas: CASExperience[] = data ?? [];

  const creativity = cas.filter((e) => e.type === "creativity");
  const activity = cas.filter((e) => e.type === "activity");
  const service = cas.filter((e) => e.type === "service");

  const typeConfig = {
    creativity: { label: "Creativity", color: "text-primary", bg: "bg-primary/10" },
    activity: { label: "Activity", color: "text-semantic-success", bg: "bg-semantic-success/10" },
    service: { label: "Service", color: "text-ink-muted", bg: "bg-surface-3" },
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/core" className="text-body-sm text-ink-subtle hover:text-ink transition-colors duration-200">The Core</Link>
          <span className="text-ink-tertiary">/</span>
          <span className="text-body-sm text-ink">CAS</span>
        </div>
        <h1 className="text-headline text-ink">Creativity, Activity, Service</h1>
        <p className="text-body-sm text-ink-subtle mt-1">{cas.length} experience{cas.length !== 1 ? "s" : ""} logged</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(["creativity", "activity", "service"] as const).map((type) => {
          const count = type === "creativity" ? creativity.length : type === "activity" ? activity.length : service.length;
          const cfg = typeConfig[type];
          return (
            <div key={type} className="bg-surface-1 border border-hairline rounded-lg p-4 text-center">
              <p className={`text-headline ${cfg.color}`}>{count}</p>
              <p className="text-caption text-ink-subtle mt-1">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {cas.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No CAS experiences yet"
          description="Log your Creativity, Activity, and Service experiences here."
        />
      ) : (
        <div className="space-y-2">
          {cas.map((exp) => {
            const cfg = typeConfig[exp.type];
            return (
              <div
                key={exp.id}
                className="flex items-start gap-3 px-4 py-3 bg-surface-1 border border-hairline rounded-md hover:border-hairline-strong transition-colors duration-200"
              >
                <span className={`text-caption px-2 py-0.5 rounded-pill shrink-0 mt-0.5 ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-ink">{exp.title}</p>
                  {exp.description && (
                    <p className="text-caption text-ink-subtle mt-0.5 truncate">{exp.description}</p>
                  )}
                </div>
                <span className="text-caption text-ink-tertiary capitalize shrink-0">{exp.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
