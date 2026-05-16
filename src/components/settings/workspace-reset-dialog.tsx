"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";

const CONFIRM_KEYWORD = "RESET";

export function WorkspaceResetDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmation === CONFIRM_KEYWORD;

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset state when dialog closes
      setConfirmation("");
      setError(null);
    }
    setOpen(next);
  }

  async function handleReset() {
    if (!isConfirmed || resetting) return;
    setResetting(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace-reset", { method: "POST" });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error ?? "Workspace reset failed.");
        setResetting(false);
        return;
      }

      router.push("/onboarding?reset=1");
      router.refresh();
    } catch {
      setError("Network error — could not reach the server.");
      setResetting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            id="workspace-reset-trigger"
            variant="ghost"
            className="text-body-sm text-destructive hover:text-destructive/80 hover:bg-destructive/10 transition-colors duration-200"
          />
        }
      >
        Reset &amp; Re-onboard
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlertIcon className="size-5 shrink-0" />
            Reset your workspace?
          </DialogTitle>
          <DialogDescription className="text-ink-subtle text-body-sm leading-relaxed">
            This action is{" "}
            <span className="font-medium text-ink-muted">irreversible</span>.
            All your data will be permanently deleted — including notes, tasks,
            resources, uploads, chat history, flashcards, IA drafts, EE / TOK /
            CAS trackers, and embeddings. You will go through onboarding again
            to set up a fresh workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <label
            htmlFor="workspace-reset-confirm"
            className="text-caption text-ink-subtle block"
          >
            Type{" "}
            <span className="font-mono font-medium text-ink">
              {CONFIRM_KEYWORD}
            </span>{" "}
            to confirm
          </label>
          <input
            id="workspace-reset-confirm"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={resetting}
            placeholder={CONFIRM_KEYWORD}
            className="w-full rounded-md bg-surface-1 border border-hairline px-3 py-2 text-body-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-destructive/60 focus:ring-1 focus:ring-destructive/30 transition-colors disabled:opacity-50"
          />

          {error && (
            <p className="text-caption text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={resetting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            id="workspace-reset-confirm-btn"
            onClick={handleReset}
            disabled={!isConfirmed || resetting}
            className="flex-1 sm:flex-none bg-destructive hover:bg-destructive/90 text-on-primary disabled:opacity-40"
          >
            {resetting ? "Resetting…" : "Reset Everything"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
