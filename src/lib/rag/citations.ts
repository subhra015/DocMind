import type { MatchResult } from "./retrieval";

export interface Citation {
  index: number;
  document_id: string;
  document_name: string;
  chunk_index: number;
  page_number: number;
  similarity: number;
  rerank_score?: number;
  excerpt: string;
}

/**
 * Parses [n] markers from the model's answer and maps them to the
 * chunks that were passed in the prompt (1-indexed).
 *
 * Returns citations in the order they first appear in the answer.
 */
export function parseCitations(
  text: string,
  chunks: MatchResult[]
): Citation[] {
  const matches = text.match(/\[(\d+)\]/g) ?? [];
  const seen = new Set<number>();
  const citations: Citation[] = [];

  for (const m of matches) {
    const num = parseInt(m.replace(/[[\]]/g, ""), 10);
    if (isNaN(num) || num < 1 || seen.has(num)) continue;
    seen.add(num);

    const chunk = chunks[num - 1];
    if (!chunk) continue;

    citations.push({
      index: num,
      document_id: chunk.document_id,
      document_name: chunk.document_name ?? "Document",
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number ?? 0,
      similarity: chunk.similarity ?? 0,
      rerank_score: (chunk as any).rerank_score,
      excerpt: chunk.content.slice(0, 200),
    });
  }

  return citations.sort((a, b) => a.index - b.index);
}