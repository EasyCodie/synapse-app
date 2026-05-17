"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function WorkspaceExportButton() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/workspace-export");
      if (!response.ok) {
        setError("Workspace export failed.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `synapse-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error - could not export workspace.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleExport}
        disabled={exporting}
        variant="secondary"
        className="w-full sm:w-auto"
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export Workspace
      </Button>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
