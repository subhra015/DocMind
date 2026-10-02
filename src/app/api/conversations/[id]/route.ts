import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { NotFoundError } from "@/lib/errors/classes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (convError || !conv) {
      throw new NotFoundError("Conversation not found.", {
        code: "CONVERSATION_NOT_FOUND",
      });
    }

    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (msgError) throw msgError;

    return createSuccessResponse(
      { ...conv, messages: messages ?? [] },
      requestId
    );
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

    // Delete messages first
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", id)
      .eq("user_id", user.id);

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return createSuccessResponse({ deleted: true }, requestId);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}