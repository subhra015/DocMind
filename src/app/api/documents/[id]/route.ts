import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { NotFoundError } from "@/lib/errors/classes";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/observability/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      throw new NotFoundError("Document not found.", {
        code: "DOCUMENT_NOT_FOUND",
        userMessage: "The requested document does not exist.",
      });
    }

    return createSuccessResponse(data, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function DELETE(
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
      .select("id, user_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !doc) {
      throw new NotFoundError("Document not found.", {
        code: "DOCUMENT_NOT_FOUND",
      });
    }

    // Soft-delete
    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "deleted" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    // Clean up chunks
    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", id)
      .eq("user_id", user.id);

    // Cancel any running ingestion job
    try {
      await inngest.send({
        name: "document/deleted",
        data: { documentId: id, userId: user.id },
      });
    } catch {
      // Best effort — job may not be running.
    }

    logger.info("document deleted", { documentId: id, userId: user.id });

    return createSuccessResponse({ deleted: true }, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}