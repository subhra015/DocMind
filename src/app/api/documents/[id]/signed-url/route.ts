import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { NotFoundError } from "@/lib/errors/classes";
import { env } from "@/lib/env";

export async function GET(
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
      .select("id, user_id, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !doc) {
      throw new NotFoundError("Document not found.", {
        code: "DOCUMENT_NOT_FOUND",
      });
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from(env().SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 15);

    if (urlError || !urlData) {
      throw new NotFoundError("Could not generate signed URL.", {
        code: "SIGNED_URL_FAILED",
      });
    }

    return createSuccessResponse(
      {
        url: urlData.signedUrl,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      requestId
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}