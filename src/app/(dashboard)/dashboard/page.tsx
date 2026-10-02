"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FileText,
  FileUp,
  MessageSquare,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DocumentRow } from "@/types";
import type { DocumentStats } from "@/types/documents";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [stats, setStats] = useState<DocumentStats>({
    total: 0,
    ready: 0,
    processing: 0,
    failed: 0,
    queued: 0,
    totalStorageMb: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabaseBrowser().auth.getUser();
      if (!user) return;

      const { data: docs } = await supabaseBrowser()
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false });

      if (!docs) return;

      setDocuments(docs as DocumentRow[]);
      setStats({
        total: docs.length,
        ready: docs.filter((d) => d.status === "ready").length,
        processing: docs.filter((d) =>
          d.status === "processing" || d.status === "queued"
        ).length,
        failed: docs.filter((d) => d.status === "failed").length,
        queued: 0,
        totalStorageMb: parseFloat(
          (docs.reduce((sum, d) => sum + d.file_size, 0) / (1024 * 1024)).toFixed(1)
        ),
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild>
          <Link href="/library">
            <FileUp className="h-4 w-4 mr-2" />
            Upload document
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total documents"
          value={stats.total}
          icon={FileText}
          description={`${stats.totalStorageMb} MB stored`}
        />
        <StatCard
          label="Ready to query"
          value={stats.ready}
          icon={BarChart3}
          description="Indexed and searchable"
        />
        <StatCard
          label="Processing"
          value={stats.processing}
          icon={FileText}
          description="Queued or in progress"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={AlertTriangle}
          description={stats.failed > 0 ? "Needs attention" : "No failures"}
          alert={stats.failed > 0}
        />
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-1 font-semibold">No documents yet</h3>
            <p className="mb-4 text-sm text-muted-foreground max-w-sm">
              Upload your first PDF to get started. Your documents are
              processed in the background and become searchable once embedding
              is complete.
            </p>
            <Button asChild>
              <Link href="/library">Go to library</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium truncate max-w-[300px]">
                        {doc.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.total_pages ?? "–"} pages · {doc.status}
                      </p>
                    </div>
                  </div>
                  {doc.status === "ready" && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/chat?document=${doc.id}`}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  description,
  alert = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  description: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon
            className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`}
          />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}