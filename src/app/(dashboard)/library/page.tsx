"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, MessageSquare, Trash2, RefreshCw, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatFileSize } from "@/lib/utils";
import type { DocumentRow } from "@/types";
import { UploadDialog } from "@/components/documents/upload-dialog";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  queued: { label: "Queued", variant: "secondary" },
  processing: { label: "Processing", variant: "warning" },
  ready: { label: "Ready", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function LibraryPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const loadDocuments = useCallback(async () => {
    const { data: { user } } = await supabaseBrowser().auth.getUser();
    if (!user) return;

    const { data } = await supabaseBrowser()
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    setDocuments((data as DocumentRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function deleteDocument(doc: DocumentRow) {
    setIsDeleting(true);
    try {
      await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setDeleteTarget(null);
    } catch {
      // error toast
    } finally {
      setIsDeleting(false);
    }
  }

  async function retryDocument(doc: DocumentRow) {
    try {
      await fetch(`/api/documents/${doc.id}/retry`, { method: "POST" });
      loadDocuments();
    } catch {
      // error toast
    }
  }

  const filtered = documents.filter((doc) => {
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    if (search && !doc.original_filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Library</h1>
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload PDF
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {["all", "ready", "processing", "failed"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {status === "all" ? "All" : STATUS_MAP[status]?.label ?? status}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">
              {documents.length === 0 ? "No documents yet" : "No matching documents"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {documents.length === 0
                ? "Upload your first PDF to get started."
                : "Try adjusting your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between gap-4 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {doc.original_filename}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant={STATUS_MAP[doc.status]?.variant ?? "secondary"}
                      className="text-xs"
                    >
                      {STATUS_MAP[doc.status]?.label ?? doc.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)} · {doc.total_pages ?? "–"} pages
                    </span>
                  </div>
                  {doc.status === "processing" && (
                    <div className="mt-2 max-w-xs">
                      <Progress value={doc.processing_progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.processing_stage ?? "Processing"}… {doc.processing_progress}%
                      </p>
                    </div>
                  )}
                  {doc.status === "failed" && doc.error_message && (
                    <p className="mt-1 text-xs text-destructive truncate max-w-sm">
                      {doc.error_message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {doc.status === "ready" && (
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => router.push(`/chat?document=${doc.id}`)}
                    title="Start chat"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                )}
                {doc.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => retryDocument(doc)}
                    title="Retry processing"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteTarget(doc)}
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.original_filename}
              </span>{" "}
              and all of its indexed chunks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteDocument(deleteTarget)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        onUploaded={loadDocuments}
      />
    </div>
  );
}