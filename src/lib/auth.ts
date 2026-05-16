import { createClient } from "@/lib/local/client";
import { redirect } from "next/navigation";
import { cache } from "react";

interface LocalUser {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
}

export const getCurrentUser = cache(async () => {
  const local = await createClient();
  const {
    data: { user },
  } = await local.auth.getUser();

  return user;
});

/**
 * Gets the authenticated user or redirects to /login.
 * Returns a non-null User — safe to use without null checks after this call.
 */
export const requireUser = cache(async (): Promise<LocalUser> => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
});

export const getWorkspaceProfile = cache(async (userId: string) => {
  const local = await createClient();

  const { data: profile } = await local
    .from("profiles")
    .select("onboarding_complete, full_name, exam_session")
    .eq("id", userId)
    .single();

  return profile;
});
