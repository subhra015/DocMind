import type { MatchResult } from "./retrieval";

export interface PromptSource {
  index: number;
  document_id: string;
  document_name: string;
  chunk_index: number;
  page_number: number;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  sources: PromptSource[];
}

export function buildRAGPrompt(
  query: string,
  chunks: MatchResult[]
): BuiltPrompt {
  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] (from "${c.document_name ?? "Document"}", page ${
          c.page_number ?? "?"
        }, chunk ${c.chunk_index}):\n${c.content}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are DocMind, an AI assistant that answers questions strictly using the provided document excerpts.

Rules:
1. Use ONLY the information in the numbered passages below. Do not use outside knowledge.
2. When you use information from a passage, cite it inline using square brackets, e.g. "The treaty was signed in 1848 [2]."
3. You may cite multiple sources: [1][3].
4. If the passages do not contain the answer, respond exactly: "I couldn't find that in the provided document."
5. Keep answers concise and factual. Never fabricate details.`;

  const userPrompt = `Context passages:

${context}

Question: ${query}

Answer with inline [n] citations:`;

  const sources: PromptSource[] = chunks.map((c, i) => ({
    index: i + 1,
    document_id: c.document_id,
    document_name: c.document_name ?? "Document",
    chunk_index: c.chunk_index,
    page_number: c.page_number ?? 0,
  }));

  return { systemPrompt, userPrompt, sources };
}