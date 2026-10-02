import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError, createSuccessResponse } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { z } from "zod";

const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
  documentId: z.string().uuid().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(100);

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
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return handleApiError(parsed.error, requestId);
    }

    const { title, documentId } = parsed.data;
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: title ?? "New Chat",
        document_id: documentId ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return createSuccessResponse(data, requestId, 201);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}