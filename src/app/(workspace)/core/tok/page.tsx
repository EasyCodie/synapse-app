import { createClient } from "@/lib/local/client";
import { requireUser } from "@/lib/auth";
import Link from "next/link";

export default async function TOKPage() {
  const user = await requireUser();
  const local = await createClient();

  const { data: tok } = await local
    .from("tok_tracker")
    .select("id, essay_title, prescribed_title, exhibition_objects, status")
    .eq("user_id", user.id)
    .single();

  const exhibitionObjects: unknown[] = Array.isArray(tok?.exhibition_objects)
    ? tok.exhibition_objects
    : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/core" className="text-body-sm text-ink-subtle hover:text-ink transition-colors duration-200">The Core</Link>
          <span className="text-ink-tertiary">/</span>
          <span className="text-body-sm text-ink">Theory of Knowledge</span>
        </div>
        <h1 className="text-headline text-ink">Theory of Knowledge</h1>
        <p className="text-body-sm text-ink-subtle mt-1">Essay + Exhibition</p>
      </div>

      {/* TOK Essay */}
      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
        <h2 className="text-card-title text-ink">TOK Essay</h2>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <p className="text-caption text-ink-subtle mb-1">Prescribed Title</p>
            <p className="text-body-sm text-ink">{tok?.prescribed_title ?? "Not selected"}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Essay Title / Angle</p>
            <p className="text-body-sm text-ink">{tok?.essay_title ?? "Not set"}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Status</p>
            <p className="text-body-sm text-ink capitalize">{tok?.status ?? "planning"}</p>
          </div>
        </div>
      </div>

      {/* TOK Exhibition */}
      <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
        <h2 className="text-card-title text-ink">TOK Exhibition</h2>
        <p className="text-body-sm text-ink-subtle">
          3 objects that connect to a TOK prompt
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((n) => {
            const obj = exhibitionObjects[n - 1] as { title?: string; description?: string } | undefined;
            return (
              <div key={n} className="flex items-start gap-3 px-4 py-3 bg-surface-2 border border-hairline rounded-md">
                <span className="text-caption text-ink-tertiary w-4 shrink-0 mt-0.5">{n}.</span>
                <div>
                  <p className="text-body-sm text-ink">{obj?.title ?? "Object not set"}</p>
                  {obj?.description && (
                    <p className="text-caption text-ink-subtle mt-0.5">{obj.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
