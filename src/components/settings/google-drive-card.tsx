"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Cloud, Unplug } from "lucide-react";
import type { DriveStatus } from "@/components/curriculum/curriculum-controls";
import { cn } from "@/lib/utils";

const buttonClass =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md px-3 py-2 text-button transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50";

const googleErrors: Record<string, string> = {
  callback_failed: "Google Drive connection failed. Check the terminal log for the exact OAuth error.",
  invalid_grant: "Google rejected the authorization code. Confirm the redirect URI matches exactly, then try again.",
  invalid_client: "Google rejected the client credentials. Check the client ID and client secret in .env.local.",
  missing_callback_params: "Google returned an incomplete callback. Start the connection again.",
  missing_refresh_token:
    "Google did not return offline access. Revoke Synapse in your Google Account permissions, then connect again.",
  not_configured: "Google Drive OAuth is not configured in .env.local.",
  redirect_uri_mismatch:
    "Google rejected the redirect URI. Add the exact callback URL to your OAuth client.",
};

export function GoogleDriveCard({ status }: { status: DriveStatus }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const googleError = searchParams.get("google_error");
  const googleErrorMessage = googleError ? googleErrors[googleError] ?? googleErrors.callback_failed : null;

  function disconnect() {
    startTransition(async () => {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-hairline bg-surface-1 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-card-title text-ink">Google Drive</h2>
          <p className="mt-1 text-body-sm text-ink-subtle">
            Create and attach Google Docs for subjects, IAs, EE, TOK, and CAS.
          </p>
        </div>
        <Cloud className="h-4 w-4 text-primary" />
      </div>

      <div className="rounded-md border border-hairline bg-surface-2 px-3 py-2">
        <p className="text-caption text-ink-subtle">Status</p>
        <p className="mt-0.5 text-body-sm text-ink">
          {!status.configured
            ? "OAuth environment variables missing"
            : status.connected
              ? "Connected"
              : "Ready to connect"}
        </p>
      </div>

      {googleErrorMessage && (
        <div className="flex gap-2 rounded-md border border-hairline-strong bg-surface-2 px-3 py-2 text-body-sm text-ink-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>{googleErrorMessage}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status.configured && !status.connected && (
          <a
            href="/api/integrations/google/connect?returnTo=%2Fsettings"
            className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}
          >
            <Cloud className="h-4 w-4" />
            Connect Drive
          </a>
        )}
        {status.connected && (
          <button
            type="button"
            disabled={isPending}
            onClick={disconnect}
            className={cn(
              buttonClass,
              "border border-hairline bg-surface-2 text-ink hover:border-hairline-strong"
            )}
          >
            <Unplug className="h-4 w-4" />
            Disconnect
          </button>
        )}
      </div>
    </section>
  );
}
