"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabaseBrowser } from "@/lib/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
}

interface SelectedFile {
  file: File;
  preview?: string;
}

export function UploadDialog({ open, onOpenChange, onUploaded }: Props) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    setError(null);
    const arr = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    if (arr.length === 0) {
      setError("Only PDF files are supported.");
      return;
    }
    setFiles((prev) => [...prev, ...arr.map((file) => ({ file }))]);
  }, []);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadAll() {
    setIsUploading(true);
    setError(null);

    try {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      if (!user) {
        setError("You must be signed in.");
        return;
      }

      for (const { file } of files) {
        // Create document record
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.error?.message ?? "Upload failed.");
          return;
        }

        const { data } = await res.json();
        if (!data?.uploadUrl) {
          setError("Failed to get upload URL.");
          return;
        }

        // Upload directly to Supabase Storage via signed URL
        const uploadRes = await fetch(data.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": "application/pdf" },
        });

        if (!uploadRes.ok) {
          setError("File upload to storage failed.");
          return;
        }

        // Confirm upload completion
        await fetch(`/api/documents/${data.documentId}/upload-complete`, {
          method: "POST",
        });
      }

      setFiles([]);
      onOpenChange(false);
      onUploaded?.();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isUploading) {
          onOpenChange(v);
          if (!v) setFiles([]);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload PDF documents</DialogTitle>
          <DialogDescription>
            Files are stored privately and processed in the background.
          </DialogDescription>
        </DialogHeader>

        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            Drop PDFs here or{" "}
            <label className="cursor-pointer text-primary hover:underline">
              browse
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </label>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Maximum 50 MB per file
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate">{f.file.name}</span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={uploadAll}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading {files.length} file{files.length > 1 ? "s" : ""}…
              </>
            ) : (
              <>
                Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}