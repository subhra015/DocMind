import { describe, it, expect } from "vitest";
import {
  chunkText,
  chunkDocument,
  normalizeWhitespace,
} from "@/lib/documents/chunker";

describe("normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("hello   world")).toBe("hello world");
  });
  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("  hello  ")).toBe("hello");
  });
  it("collapses newlines", () => {
    expect(normalizeWhitespace("line1\n\n\nline2")).toBe("line1 line2");
  });
});

describe("chunkText", () => {
  it("returns empty array for empty text", () => {
    expect(chunkText("", 1, 0)).toEqual([]);
    expect(chunkText("   \n  \n  ", 1, 0)).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const result = chunkText("Hello world", 1, 0);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Hello world");
    expect(result[0].chunk_index).toBe(0);
  });

  it("splits long text into multiple chunks", () => {
    const text = "A".repeat(100) + " " + "B".repeat(100) + " " + "C".repeat(100) + " " + "D".repeat(100);
    const result = chunkText(text, 1, 0, {
      maxChunkCharacters: 200,
      overlapCharacters: 30,
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (const chunk of result) {
      expect(chunk.content.length).toBeLessThanOrEqual(200);
    }
  });

  it("preserves chunk_index starting at sequenceStart", () => {
    const result = chunkText("A ".repeat(500), 1, 5, {
      maxChunkCharacters: 100,
      overlapCharacters: 20,
    });
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].chunk_index).toBe(5);
    expect(result[1].chunk_index).toBe(6);
  });

  it("skips empty pages", () => {
    expect(chunkText("", 3, 0)).toEqual([]);
  });

  it("handles unicode text", () => {
    const text = "日本語テスト 日本語テスト 日本語テスト";
    const result = chunkText(text, 1, 0, {
      maxChunkCharacters: 10,
      overlapCharacters: 2,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it("prefers paragraph breaks when splitting", () => {
    const text = "Paragraph one.\n\n".repeat(5);
    const result = chunkText(text, 1, 0, {
      maxChunkCharacters: 30,
      overlapCharacters: 5,
    });
    expect(result.length).toBeGreaterThan(1);
  });
});

describe("chunkDocument", () => {
  it("chunks a multi-page document with correct page numbers", () => {
    const pages = [
      { pageNumber: 1, content: "Page one content " + "A".repeat(100) },
      { pageNumber: 2, content: "Page two content " + "B".repeat(100) },
    ];
    const chunks = chunkDocument(pages, "doc-1", "user-1", {
      maxChunkCharacters: 60,
      overlapCharacters: 10,
    });
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.document_id).toBe("doc-1");
      expect(chunk.user_id).toBe("user-1");
      expect([1, 2]).toContain(chunk.page_number);
      expect(chunk.metadata.source_type).toBe("pdf");
    }
  });

  it("produces stable sequential chunk indices", () => {
    const pages = [
      { pageNumber: 1, content: "A".repeat(200) },
      { pageNumber: 2, content: "B".repeat(200) },
    ];
    const chunks = chunkDocument(pages, "d", "u", {
      maxChunkCharacters: 100,
      overlapCharacters: 20,
    });
    const indices = chunks.map((c) => c.chunk_index);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("skips empty pages without breaking", () => {
    const pages = [
      { pageNumber: 1, content: "Content here" },
      { pageNumber: 2, content: "" },
      { pageNumber: 3, content: "More content" },
    ];
    const chunks = chunkDocument(pages, "d", "u");
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("never produces empty chunk content", () => {
    const pages = [
      { pageNumber: 1, content: "Hello" },
      { pageNumber: 2, content: "" },
    ];
    const chunks = chunkDocument(pages, "d", "u");
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});