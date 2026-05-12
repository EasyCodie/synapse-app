import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, full_name")
    .eq("id", user.id)
    .single();

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
