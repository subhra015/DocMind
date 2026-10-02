import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit/client";
import { RateLimitError } from "@/lib/errors/classes";
import { inngest } from "@/inngest/client";
import { env } from "@/lib/env";
import { createDocumentSchema } from "@/lib/documents/validation";
import { sanitizeFilename } from "@/lib/utils";
import { logger } from "@/lib/observability/logger";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return createSuccessResponse(data, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();

    // Rate limit
    const rateResult = await checkRateLimit("upload", user.id);
    if (rateResult && !rateResult.success) {
      const retryAfter = Math.ceil((rateResult.reset - Date.now()) / 1000);
      throw new RateLimitError("Too many uploads.", { retryAfter });
    }

    const body = await request.json();
    const parsed = createDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return handleApiError(parsed.error, requestId);
    }

    const { filename, fileSize, mimeType } = parsed.data;
    const supabase = createSupabaseServiceClient();
    const documentId = crypto.randomUUID();
    const sanitized = sanitizeFilename(filename);
    const storagePath = `${user.id}/${documentId}/${sanitized}`;

    // Check for duplicate checksum if provided
    const checksum = (body.checksum as string | undefined) ?? null;
    if (checksum) {
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("user_id", user.id)
        .eq("checksum", checksum)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "DUPLICATE_DOCUMENT",
              message: "A document with this checksum already exists.",
            },
            requestId,
          },
          { status: 409 }
        );
      }
    }

    // Create document record
    const { error: insertError } = await supabase.from("documents").insert({
      id: documentId,
      user_id: user.id,
      filename: sanitized,
      original_filename: filename,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: fileSize,
      checksum,
      status: "queued",
      processing_progress: 0,
    });

    if (insertError) {
      throw insertError;
    }

    // Generate signed upload URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from(env().SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (urlError) {
      throw urlError;
    }

    logger.info("document created", {
      documentId,
      userId: user.id,
    });

    return createSuccessResponse(
      {
        documentId,
        uploadUrl: urlData.signedUrl,
        storagePath,
        expiresIn: urlData.signedUrl ? 600 : 0,
      },
      requestId
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}