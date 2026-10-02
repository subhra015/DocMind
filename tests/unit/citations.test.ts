import { describe, it, expect } from "vitest";
import { parseCitations, citationsToMarkdownLinks } from "@/lib/rag/citations";
import type { MatchResult } from "@/lib/rag/retrieval";

const mockChunks: MatchResult[] = [
  {
    id: "chunk-1",
    document_id: "doc-1",
    content: "First chunk content about architecture.",
    page_number: 4,
    chunk_index: 0,
    similarity: 0.9,
    metadata: { filename: "architecture.pdf", source_type: "pdf" },
  },
  {
    id: "chunk-2",
    document_id: "doc-1",
    content: "Second chunk about security.",
    page_number: 12,
    chunk_index: 1,
    similarity: 0.85,
    metadata: { filename: "architecture.pdf", source_type: "pdf" },
  },
  {
    id: "chunk-3",
    document_id: "doc-2",
    content: "Third chunk from another doc.",
    page_number: 1,
    chunk_index: 0,
    similarity: 0.8,
    metadata: { filename: "design.pdf", source_type: "pdf" },
  },
];

describe("parseCitations", () => {
  it("extracts single citation", () => {
    const text =
      "The architecture is modular [Source: architecture.pdf, page 4] as shown.";
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(1);
    expect(citations[0].pageNumber).toBe(4);
    expect(citations[0].filename).toBe("architecture.pdf");
    expect(citations[0].documentId).toBe("doc-1");
    expect(citations[0].chunkId).toBe("chunk-1");
  });

  it("extracts multiple citations", () => {
    const text =
      "Points A [Source: architecture.pdf, page 4] and B [Source: design.pdf, page 1].";
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(2);
    expect(citations.map((c) => c.pageNumber)).toEqual([4, 1]);
  });

  it("deduplicates repeated citations", () => {
    const text =
      "This [Source: architecture.pdf, page 4] and that [Source: architecture.pdf, page 4].";
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(1);
  });

  it("returns empty array when no citations found", () => {
    const text = "This is a plain sentence without sources.";
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(0);
  });

  it("provides fallback for citations not in chunks", () => {
    const text = "See [Source: unknown.pdf, page 99] for details.";
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(1);
    expect(citations[0].filename).toBe("unknown.pdf");
    expect(citations[0].pageNumber).toBe(99);
  });
});

describe("citationsToMarkdownLinks", () => {
  it("formats citations as markdown links", () => {
    const citations = parseCitations(
      "See [Source: architecture.pdf, page 4].",
      mockChunks
    );
    const links = citationsToMarkdownLinks(citations);
    expect(links).toContain("architecture.pdf");
    expect(links).toContain("p.4");
    expect(links).toContain("citation:doc-1:4");
  });
});