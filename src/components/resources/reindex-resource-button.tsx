"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReindexResourceButton({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [reindexing, setReindexing] = useState(false);

  async function handleReindex() {
    if (reindexing) return;
    setReindexing(true);

    try {
      await fetch("/api/resources/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_id: resourceId }),
      });
      router.refresh();
    } finally {
      setReindexing(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleReindex}
      disabled={reindexing}
      aria-label="Reindex resource"
      title="Reindex resource"
      className="h-8 w-8 text-ink-tertiary hover:text-ink"
    >
      <RefreshCw className={`h-4 w-4 ${reindexing ? "animate-spin" : ""}`} />
    </Button>
  );
}
