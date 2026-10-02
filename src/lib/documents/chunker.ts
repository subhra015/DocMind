import { z } from "zod";

export const MAX_PDF_BYTES_MAGIC = 5;

export const PDF_MAGIC_BYTES = "%PDF-";

export interface ParsedChunk {
  document_id: string;
  user_id: string;
  page_number: number;
  chunk_index: number;
  content: string;
  token_count: number;
  character_count: number;
  metadata: {
    page_number: number;
    chunk_index: number;
    section_title?: string;
    source_type: string;
    [key: string]: unknown;
  };
}

export interface ChunkerOptions {
  maxChunkCharacters: number;
  overlapCharacters: number;
}

export const DEFAULT_CHUNKER_OPTIONS: ChunkerOptions = {
  maxChunkCharacters: 1600,
  overlapCharacters: 250,
};

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Extracts a plausible heading line from a text block.
 * Handles markdown-style headings, numbered headings, and uppercase headers.
 */
function extractSectionTitle(
  text: string,
  maxLength: number
): string | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const stripped = line.replace(/^#{1,6}\s+/, "");
    if (
      (stripped.length >= 3 &&
        stripped.length <= 100 &&
        /^[A-Z0-9]/.test(stripped) &&
        !stripped.endsWith(".") &&
        stripped.split(" ").length <= 12)
    ) {
      return stripped.substring(0, maxLength);
    }
  }
  return undefined;
}

function estimateTokenCount(text: string): number {
  // Rough heuristic: ~4 characters per token on average for English.
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Splits a single page's content into overlapping chunks.
 * Chunks are split at paragraph boundaries when possible and never
 * exceed maxChunkCharacters characters.
 */
export function chunkText(
  text: string,
  pageNumber: number,
  sequenceStart: number,
  options: ChunkerOptions = DEFAULT_CHUNKER_OPTIONS
): { content: string; chunk_index: number; section_title?: string }[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const { maxChunkCharacters, overlapCharacters } = options;
  const sectionTitle = extractSectionTitle(normalized, 80);

  const results: {
    content: string;
    chunk_index: number;
    section_title?: string;
  }[] = [];

  let index = sequenceStart;
  let start = 0;
  const length = normalized.length;

  if (length <= maxChunkCharacters) {
    results.push({
      content: normalized,
      chunk_index: index,
      section_title: sectionTitle,
    });
    return results;
  }

  while (start < length) {
    let end = Math.min(start + maxChunkCharacters, length);

    // Prefer breaking at paragraph boundaries within the window.
    let breakPoint = normalized.lastIndexOf("\n\n", end);
    if (breakPoint > start + maxChunkCharacters * 0.5) {
      end = breakPoint;
    } else {
      // Fall back to sentence boundary.
      breakPoint = normalized.lastIndexOf(". ", end);
      if (breakPoint > start + maxChunkCharacters * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      results.push({
        content: chunk,
        chunk_index: index,
        section_title: index === sequenceStart ? sectionTitle : undefined,
      });
      index += 1;
    }

    if (end >= length) {
      break;
    }

    start = Math.max(start + 1, end - overlapCharacters);
  }

  return results;
}

/**
 * Chunks a full multi-page document into a flat list of chunks.
 * Each chunk retains its originating page number.
 */
export function chunkDocument(
  pages: { pageNumber: number; content: string }[],
  documentId: string,
  userId: string,
  options: ChunkerOptions = DEFAULT_CHUNKER_OPTIONS
): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkText(
      page.content,
      page.pageNumber,
      globalIndex,
      options
    );

    for (const item of pageChunks) {
      chunks.push({
        document_id: documentId,
        user_id: userId,
        page_number: page.pageNumber,
        chunk_index: item.chunk_index,
        content: item.content,
        token_count: estimateTokenCount(item.content),
        character_count: item.content.length,
        metadata: {
          page_number: page.pageNumber,
          chunk_index: item.chunk_index,
          section_title: item.section_title,
          source_type: "pdf",
        },
      });
      globalIndex += 1;
    }
  }

  return chunks;
}