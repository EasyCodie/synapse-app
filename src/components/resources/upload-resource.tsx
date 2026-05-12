"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadResourceProps {
  subjects: Array<{ id: string; subject_name: string }>;
}

export function UploadResource({ subjects }: UploadResourceProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFileSelect(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    setError(null);
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
        setUploading(false);
        return;
      }

      // Success — reset and close
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
          onClick={() => {
            setOpen(false);
            setFile(null);
            setError(null);
          }}
          className="text-ink-subtle hover:text-ink p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
              : "border-hairline hover:border-hairline-strong"
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

      {/* Title */}
      <div>
        <label className="text-caption text-ink-subtle block mb-1">Title</label>
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
              {s.subject_name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-caption text-destructive">{error}</p>}

      <Button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-primary hover:bg-primary-hover text-on-primary"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Resource
          </>
        )}
      </Button>
    </div>
  );
}
