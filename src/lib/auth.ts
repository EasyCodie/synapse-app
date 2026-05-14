import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/**
 * Gets the authenticated user or redirects to /login.
 * Returns a non-null User — safe to use without null checks after this call.
 */
export const requireUser = cache(async (): Promise<User> => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

export const getWorkspaceProfile = cache(async (userId: string) => {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, full_name, exam_session")
    .eq("id", userId)
    .single();

  return profile;
});
