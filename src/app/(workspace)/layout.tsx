import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { getWorkspaceProfile, requireUser } from "@/lib/auth";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getWorkspaceProfile(user.id);

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  return (
    <WorkspaceShell
      userEmail={user.email}
      userName={profile?.full_name ?? undefined}
    >
      {children}
    </WorkspaceShell>
  );
}
