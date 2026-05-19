"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteResourceButton({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this resource? This cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/resources/${resourceId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleDelete();
      }}
      disabled={deleting}
      className="rounded-md p-1.5 text-ink-tertiary transition-colors duration-200 hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary/50"
      aria-label="Delete resource"
      title="Delete resource"
    >
      {deleting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
