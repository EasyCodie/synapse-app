import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar/sidebar-nav";
import { MobileSidebarToggle } from "@/components/sidebar/mobile-sidebar-toggle";

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
    <div className="flex h-screen bg-canvas overflow-hidden">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-surface-1 border-r border-hairline">
        <SidebarNav
          userEmail={user.email}
          userName={profile?.full_name ?? undefined}
        />
      </aside>

      {/* Mobile sidebar toggle */}
      <MobileSidebarToggle
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
