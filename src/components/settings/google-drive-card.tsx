"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Cloud, RefreshCw, Unplug } from "lucide-react";
import type { DriveStatus } from "@/components/curriculum/curriculum-controls";
import { cn } from "@/lib/utils";

const buttonClass =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md px-3 py-2 text-button transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50";

const googleErrors: Record<string, string> = {
  callback_failed: "Drive did not finish connecting. Try again from Settings.",
  invalid_grant: "That sign-in attempt expired. Reconnect Drive when you are ready.",
  invalid_client: "Drive could not verify this connection. Check your Google setup, then try again.",
  missing_callback_params: "Drive returned without the information Synapse needs. Start the connection again.",
  missing_refresh_token:
    "Drive connected without long-term access. Remove Synapse from your Google Account permissions, then connect again.",
  not_configured: "Drive document syncing is not set up yet. You can keep using local resources.",
  redirect_uri_mismatch:
    "Drive could not return to Synapse. Check the Google connection setup, then reconnect.",
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

  const statusText = !status.configured
    ? "Not set up"
    : status.connected
      ? "Connected"
      : status.needsRefresh
        ? "Connection expired, please reconnect"
        : "Ready to connect";

  return (
    <section className="space-y-4 rounded-lg border border-hairline bg-canvas p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-cell font-medium text-ink">Google Drive</h2>
          <p className="mt-1 text-cell text-ink-subtle">
            Create and attach Google Docs for subjects, IAs, EE, TOK, and CAS.
          </p>
        </div>
        <Cloud className="h-4 w-4 text-primary" />
      </div>

      <div className="rounded-md border border-hairline bg-surface-2 px-3 py-2">
        <p className="text-[11px] text-ink-tertiary">Status</p>
        <p className={cn(
          "mt-0.5 text-cell",
          status.needsRefresh ? "text-primary" : "text-ink"
        )}>
          {statusText}
        </p>
      </div>

      {googleErrorMessage && (
        <div className="flex gap-2 rounded-md border border-hairline-strong bg-surface-2 px-3 py-2 text-cell text-ink-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>{googleErrorMessage}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status.configured && !status.connected && !status.needsRefresh && (
          <a
            href="/api/integrations/google/connect?returnTo=%2Fsettings"
            className={cn(buttonClass, "bg-primary text-on-primary hover:bg-primary-hover")}
          >
            <Cloud className="h-4 w-4" />
            Connect Drive
          </a>
        )}
        {status.configured && status.needsRefresh && (
          <a
            href="/api/integrations/google/connect?returnTo=%2Fsettings"
            className={cn(buttonClass, "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20")}
          >
            <RefreshCw className="h-4 w-4" />
            Reconnect Drive
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
