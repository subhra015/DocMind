import { getGeminiClient } from "@/lib/embeddings/gemini";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import type { MatchResult } from "@/lib/rag/retrieval";

export interface RerankedResult extends MatchResult {
  rerank_score: number;
}

/**
 * Re-scores retrieved chunks using Gemini Flash as an LLM judge.
 *
 * Why: Vector + keyword search optimises for "similar to the query",
 * but a chunk can be similar yet not actually answer the question.
 * An LLM judge reads the passage and scores true relevance (0–10).
 * We keep only the top K after re-scoring.
 */
export async function rerankChunks(
  query: string,
  chunks: MatchResult[],
  topK: number = 5
): Promise<RerankedResult[]> {
  if (chunks.length === 0) return [];

  // If we have fewer chunks than topK, still score them for consistency.
  const ai = getGeminiClient();

  // Trim each chunk to 800 chars so the prompt stays small and cheap.
  const passages = chunks
    .map(
      (c, i) =>
        `[${i}] (from "${c.document_name ?? "document"}", page ${
          c.page_number ?? "?"
        }):\n${c.content.slice(0, 800)}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are a relevance judge for a retrieval-augmented generation system.

Score each passage from 0 (completely irrelevant) to 10 (directly and fully answers the user's query) based on how useful it is for answering the query.

User query: "${query}"

Passages:
${passages}

Return ONLY a JSON array of integers in the SAME ORDER as the passages above.
Example: [8, 3, 10, 0, 5, 2, 7, 1, 4, 6]
No prose, no markdown, no explanation. Just the array.`;

  try {
    const response = await ai.models.generateContent({
      model: env().GEMINI_CHAT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text ?? "";
    // Extract the first [...] block from the response.
    const match = text.match(/\[[\s\d,\.]+\]/);
    if (!match) {
      logger.warn("rerank: could not parse scores; falling back to RRF order", {
        raw: text.slice(0, 200),
      });
      return chunks
        .slice(0, topK)
        .map((c) => ({ ...c, rerank_score: c.rrf_score ?? 0 }));
    }

    const scores = JSON.parse(match[0]) as number[];

    const scored: RerankedResult[] = chunks.map((chunk, i) => ({
      ...chunk,
      rerank_score: typeof scores[i] === "number" ? scores[i] : 0,
    }));

    return scored.sort((a, b) => b.rerank_score - a.rerank_score).slice(0, topK);
  } catch (err) {
    logger.error("rerank: Gemini call failed; falling back to RRF order", {
      error: String(err),
    });
    return chunks
      .slice(0, topK)
      .map((c) => ({ ...c, rerank_score: c.rrf_score ?? 0 }));
  }
}