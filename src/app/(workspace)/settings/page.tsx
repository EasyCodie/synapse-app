import { createClient } from "@/lib/local/client";
import { getWorkspaceProfile, requireUser } from "@/lib/auth";

type SettingsSubject = {
  id: string;
  subject_name: string;
  level: string;
  subject_group: number;
};

export default async function SettingsPage() {
  const user = await requireUser();
  const local = await createClient();

  const [profile, subjectsResult] = await Promise.all([
    getWorkspaceProfile(user.id),
    local
      .from("user_subjects")
      .select("id, subject_name, level, subject_group")
      .eq("user_id", user.id)
      .order("subject_group"),
  ]);

  const subjects = (subjectsResult.data ?? []) as SettingsSubject[];

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-headline text-ink">Settings</h1>
        <p className="text-body-sm text-ink-subtle mt-1">Workspace configuration</p>
      </div>

      {/* Account */}
      <section className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
        <h2 className="text-card-title text-ink">Account</h2>
        <div className="space-y-3">
          <div>
            <p className="text-caption text-ink-subtle mb-1">Name</p>
            <p className="text-body-sm text-ink">{profile?.full_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Email</p>
            <p className="text-body-sm text-ink">{user.email}</p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle mb-1">Exam Session</p>
            <p className="text-body-sm text-ink">{profile?.exam_session ?? "—"}</p>
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
        <h2 className="text-card-title text-ink">Subjects</h2>
        <div className="space-y-2">
          {(subjects ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-hairline last:border-0">
              <span className="text-body-sm text-ink">{s.subject_name}</span>
              <span className={`text-caption px-2 py-0.5 rounded-pill ${s.level === "HL" ? "bg-primary/10 text-primary" : "bg-surface-3 text-ink-subtle"}`}>
                {s.level}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-3">
        <h2 className="text-card-title text-ink">Session</h2>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="text-body-sm text-destructive hover:text-destructive/80 transition-colors duration-200"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
