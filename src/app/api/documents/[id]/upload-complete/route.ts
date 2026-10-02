import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { NotFoundError } from "@/lib/errors/classes";
import { inngest } from "@/inngest/client";
import { storageObjectExists } from "@/lib/storage/client";
import { logger } from "@/lib/observability/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("id, user_id, storage_path, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !doc) {
      throw new NotFoundError("Document not found.", {
        code: "DOCUMENT_NOT_FOUND",
      });
    }

    // Verify the file exists in storage
    const exists = await storageObjectExists(doc.storage_path);
    if (!exists) {
      throw new NotFoundError("Uploaded file not found in storage.", {
        code: "STORAGE_FILE_NOT_FOUND",
        userMessage: "The file upload could not be confirmed. Please re-upload.",
      });
    }

    // Update status to queued and enqueue ingestion
    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "queued", processing_progress: 0 })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    await inngest.send({
      name: "document/process",
      data: { documentId: id, userId: user.id },
    });

    logger.info("ingestion enqueued", { documentId: id, userId: user.id });

    return createSuccessResponse({ enqueued: true }, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}