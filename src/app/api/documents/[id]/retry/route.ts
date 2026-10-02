import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { NotFoundError, DocumentError } from "@/lib/errors/classes";
import { checkRateLimit } from "@/lib/rate-limit/client";
import { RateLimitError } from "@/lib/errors/classes";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/observability/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();

    // Rate limit
    const rateResult = await checkRateLimit("retry", user.id);
    if (rateResult && !rateResult.success) {
      const retryAfter = Math.ceil((rateResult.reset - Date.now()) / 1000);
      throw new RateLimitError("Too many retry requests.", { retryAfter });
    }

    const { id } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("id, user_id, status, retry_count")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !doc) {
      throw new NotFoundError("Document not found.", {
        code: "DOCUMENT_NOT_FOUND",
      });
    }

    if (doc.status !== "failed") {
      throw new DocumentError("Only failed documents can be retried.", {
        code: "INVALID_RETRY_STATE",
        userMessage: "This document is not in a failed state.",
      });
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "queued",
        processing_progress: 0,
        processing_stage: null,
        error_message: null,
        retry_count: doc.retry_count + 1,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    await inngest.send({
      name: "document/process",
      data: { documentId: id, userId: user.id },
    });

    logger.info("document retry enqueued", {
      documentId: id,
      userId: user.id,
    });

    return createSuccessResponse({ enqueued: true }, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}