import type { SupabaseClient } from "@supabase/supabase-js";

export interface MatchResult {
  id: string;
  document_id: string;
  content: string;
  page_number: number;
  chunk_index: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * Calls the secure match_document_chunks RPC function.
 * Never trusts documentId/userId from the client — they come from
 * the verified session on the server.
 */
export async function matchChunks(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  userId: string,
  documentId: string | null | undefined,
  matchCount: number,
  threshold: number
): Promise<MatchResult[]> {
  const { data, error } = await supabase.rpc(
    "match_document_chunks" as never,
    {
      query_embedding: queryEmbedding,
      requested_user_id: userId,
      requested_document_id: documentId ?? null,
      similarity_threshold: threshold,
      match_count: Math.min(matchCount, 20),
    } as never
  );

  if (error) {
    console.error("match_document_chunks RPC error:", error);
    return [];
  }

  return (data ?? []) as MatchResult[];
}