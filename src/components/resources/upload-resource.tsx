"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Loader2, Link2, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DriveStatus } from "@/components/curriculum/curriculum-controls";
import { cn } from "@/lib/utils";
import { displaySubjectName } from "@/lib/subject-display";

interface UploadResourceProps {
  subjects: Array<{ id: string; subject_name: string }>;
  driveStatus: DriveStatus;
}

type ImportMode = "file" | "google";

export function UploadResource({ subjects, driveStatus }: UploadResourceProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFileSelect(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    setError(null);
  }

  function resetPanel() {
    setOpen(false);
    setFile(null);
    setGoogleUrl("");
    setError(null);
    setStatus(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setStatus("Uploading and extracting text...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title || file.name);
    if (subjectId) formData.append("subject_id", subjectId);

    try {
      const res = await fetch("/api/resources/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        setStatus(null);
        setUploading(false);
        return;
      }

      // Success — reset and close
      setStatus(
        `Upload complete. Extraction: ${formatStatus(data.extraction_status ?? "unknown")}. Indexing: ${formatStatus(data.indexing_status ?? "unknown")}.`,
      );
      setFile(null);
      setTitle("");
      setSubjectId("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleGoogleImport() {
    const documentUrl = googleUrl.trim();
    if (!documentUrl) return;
    setUploading(true);
    setError(null);
    setStatus("Importing Google Doc and preparing AI search...");

    try {
      const res = await fetch("/api/resources/import-google-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_url: documentUrl,
          title: title.trim() || undefined,
          subject_id: subjectId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setStatus(null);
        setUploading(false);
        return;
      }

      setStatus(
        `Import complete. Extraction: ${formatStatus(data.extraction_status ?? "unknown")}. Indexing: ${formatStatus(data.indexing_status ?? "unknown")}.`,
      );
      setGoogleUrl("");
      setTitle("");
      setSubjectId("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="bg-primary hover:bg-primary-hover text-on-primary"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload
      </Button>
    );
  }

  return (
    <div className="bg-surface-1 border border-hairline rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-card-title text-ink">Upload Resource</h3>
        <button
          onClick={resetPanel}
          className="text-ink-subtle hover:text-ink p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-md border border-hairline bg-surface-2 p-1">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={cn(
            "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md px-3 py-2 text-button transition-colors duration-200",
            mode === "file"
              ? "bg-primary text-on-primary"
              : "text-ink-subtle hover:text-ink",
          )}
        >
          <Upload className="h-4 w-4" />
          File
        </button>
        <button
          type="button"
          onClick={() => setMode("google")}
          className={cn(
            "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md px-3 py-2 text-button transition-colors duration-200",
            mode === "google"
              ? "bg-primary text-on-primary"
              : "text-ink-subtle hover:text-ink",
          )}
        >
          <Link2 className="h-4 w-4" />
          Google Doc
        </button>
      </div>

      {mode === "file" ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors duration-200",
              dragOver
                ? "border-primary bg-primary/5"
                : file
                  ? "border-hairline-strong bg-surface-2"
                  : "border-hairline hover:border-hairline-strong",
            )}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <p className="text-body-sm text-ink">{file.name}</p>
                  <p className="text-caption text-ink-subtle">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <Upload className="w-6 h-6 text-ink-subtle mx-auto mb-2" />
                <p className="text-body-sm text-ink-subtle">
                  Drop a file here or click to browse
                </p>
                <p className="text-caption text-ink-subtle mt-1">
                  PDF, DOCX, PPTX, TXT, MD (max 50MB)
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.pptx,.txt,.md"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-hairline bg-surface-2 p-4">
          {driveStatus.configured && driveStatus.connected ? (
            <div>
              <label className="text-caption text-ink-subtle block mb-1">
                Google Docs URL
              </label>
              <input
                type="url"
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                className="w-full px-3 py-2 bg-surface-1 border border-hairline rounded-md text-body-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-hairline-strong"
              />
            </div>
          ) : driveStatus.configured ? (
            <a
              href="/api/integrations/google/connect?returnTo=%2Fresources"
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-button text-on-primary transition-colors duration-200 hover:bg-primary-hover"
            >
              <Cloud className="h-4 w-4" />
              Connect Drive
            </a>
          ) : (
            <p className="rounded-md border border-hairline bg-surface-1 px-3 py-2 text-caption text-ink-subtle">
              Add Google OAuth environment variables to import Google Docs.
            </p>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-caption text-ink-subtle block mb-1">
          Title {mode === "google" ? "(optional)" : ""}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resource title"
          className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-md text-body-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:border-hairline-strong"
        />
      </div>

      {/* Subject */}
      <div>
        <label className="text-caption text-ink-subtle block mb-1">
          Subject (optional)
        </label>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="w-full px-3 py-2 bg-surface-2 border border-hairline rounded-md text-body-sm text-ink focus:outline-none focus:border-hairline-strong"
        >
          <option value="">No subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {displaySubjectName(s.subject_name)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-caption text-destructive">{error}</p>}
      {status && <p className="text-caption text-ink-subtle">{status}</p>}

      <Button
        onClick={mode === "file" ? handleUpload : handleGoogleImport}
        disabled={
          uploading ||
          (mode === "file"
            ? !file
            : !googleUrl.trim() || !driveStatus.connected)
        }
        className="w-full bg-primary hover:bg-primary-hover text-on-primary"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {mode === "file" ? "Uploading..." : "Importing..."}
          </>
        ) : mode === "file" ? (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Resource
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4 mr-2" />
            Import Google Doc
          </>
        )}
      </Button>
    </div>
  );
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}
