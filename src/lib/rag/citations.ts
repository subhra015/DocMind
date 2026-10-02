import type { MatchResult } from "./retrieval";
import type { CitationSource } from "@/types";

const CITATION_PATTERN =
  /\[Source:\s*([^,\]]+),\s*page\s*(\d+)\]/g;

/**
 * Parses citations from the assistant's response text.
 * Maps each [Source: filename, page N] reference to structured data.
 */
export function parseCitations(
  text: string,
  chunks: MatchResult[]
): CitationSource[] {
  const matches: Array<{ filename: string; pageNumber: number }> = [];

  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = CITATION_PATTERN.exec(text)) !== null) {
    const filename = match[1].trim();
    const pageNumber = parseInt(match[2], 10);

    const key = `${filename}:${pageNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      matches.push({ filename, pageNumber });
    }
  }

  // Map to full citation objects using chunk data
  const citations: CitationSource[] = [];

  for (const { filename, pageNumber } of matches) {
    const matchingChunks = chunks.filter(
      (c) =>
        c.page_number === pageNumber &&
        ((c.metadata as Record<string, unknown>)?.filename as string) ===
          filename
    );

    const bestChunk = matchingChunks[0];

    if (bestChunk) {
      citations.push({
        documentId: bestChunk.document_id,
        filename,
        pageNumber,
        chunkId: bestChunk.id,
        excerpt:
          bestChunk.content.substring(0, 300) +
          (bestChunk.content.length > 300 ? "…" : ""),
      });
    } else {
      // Best-effort: find closest chunk by page number
      const fallback = chunks.find((c) => c.page_number === pageNumber);
      citations.push({
        documentId: fallback?.document_id ?? "",
        filename,
        pageNumber,
        chunkId: fallback?.id ?? "",
        excerpt:
          fallback?.content.substring(0, 300) ?? "Source not available.",
      });
    }
  }

  return citations;
}

/**
 * Converts parsed citations into markdown-compatible links
 * that can be rendered in the UI.
 */
export function citationsToMarkdownLinks(
  citations: CitationSource[]
): string {
  return citations
    .map(
      (c) =>
        `[${c.filename}, p.${c.pageNumber}](citation:${c.documentId}:${c.pageNumber})`
    )
    .join(", ");
}