import { describe, it, expect } from "vitest";
import {
  validateFileMetadata,
  hasPdfMagicBytes,
  isPdfExtension,
  isValidMimeType,
  checkFilename,
  computeChecksum,
  validatePdfBuffer,
} from "@/lib/documents/validation";
import { DocumentError } from "@/lib/errors/classes";

describe("hasPdfMagicBytes", () => {
  it("returns true for valid PDF header", () => {
    const bytes = new TextEncoder().encode("%PDF-1.4");
    expect(hasPdfMagicBytes(bytes)).toBe(true);
  });

  it("returns false for short buffers", () => {
    expect(hasPdfMagicBytes(new Uint8Array([0x25, 0x50]))).toBe(false);
  });

  it("returns false for non-PDF content", () => {
    const bytes = new TextEncoder().encode("MZ\x90\x00\x03");
    expect(hasPdfMagicBytes(bytes)).toBe(false);
  });
});

describe("isPdfExtension", () => {
  it("accepts .pdf", () => {
    expect(isPdfExtension("document.pdf")).toBe(true);
    expect(isPdfExtension("DOCUMENT.PDF")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isPdfExtension("doc.txt")).toBe(false);
    expect(isPdfExtension("noext")).toBe(false);
    expect(isPdfExtension("pdf.jpg")).toBe(false);
  });
});

describe("isValidMimeType", () => {
  it("accepts application/pdf", () => {
    expect(isValidMimeType("application/pdf")).toBe(true);
  });

  it("accepts application/x-pdf", () => {
    expect(isValidMimeType("application/x-pdf")).toBe(true);
  });

  it("rejects image/png", () => {
    expect(isValidMimeType("image/png")).toBe(false);
  });
});

describe("checkFilename", () => {
  it("returns the trimmed filename on valid input", () => {
    expect(checkFilename("my_doc.pdf")).toBe("my_doc.pdf");
  });

  it("throws for empty filename", () => {
    expect(() => checkFilename("")).toThrow(DocumentError);
    expect(() => checkFilename("   ")).toThrow(DocumentError);
  });

  it("throws for too-long filename", () => {
    expect(() => checkFilename("a".repeat(256) + ".pdf")).toThrow(DocumentError);
  });

  it("throws for wrong extension", () => {
    expect(() => checkFilename("file.txt")).toThrow(DocumentError);
  });
});

describe("validateFileMetadata", () => {
  it("passes with valid input", () => {
    expect(() =>
      validateFileMetadata({
        filename: "test.pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
      })
    ).not.toThrow();
  });

  it("throws for zero-size file", () => {
    expect(() =>
      validateFileMetadata({
        filename: "test.pdf",
        fileSize: 0,
        mimeType: "application/pdf",
      })
    ).toThrow(DocumentError);
  });

  it("throws for too-large file", () => {
    expect(() =>
      validateFileMetadata({
        filename: "test.pdf",
        fileSize: 100 * 1024 * 1024,
        mimeType: "application/pdf",
      })
    ).toThrow(DocumentError);
  });

  it("throws for invalid MIME type", () => {
    expect(() =>
      validateFileMetadata({
        filename: "test.pdf",
        fileSize: 1024,
        mimeType: "text/plain",
      })
    ).toThrow(DocumentError);
  });
});

describe("validatePdfBuffer", () => {
  it("passes for valid PDF buffer", () => {
    const buffer = new TextEncoder().encode("%PDF-1.4 some content");
    expect(() => validatePdfBuffer(buffer)).not.toThrow();
  });

  it("throws for empty buffer", () => {
    expect(() => validatePdfBuffer(new Uint8Array(0))).toThrow(DocumentError);
  });

  it("throws for non-PDF content", () => {
    const buffer = new TextEncoder().encode("not a pdf");
    expect(() => validatePdfBuffer(buffer)).toThrow(DocumentError);
  });
});

describe("computeChecksum", () => {
  it("returns a 64-char hex string", async () => {
    const buffer = new TextEncoder().encode("test content");
    const checksum = await computeChecksum(buffer);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns same hash for same content", async () => {
    const buf1 = new TextEncoder().encode("identical");
    const buf2 = new TextEncoder().encode("identical");
    expect(await computeChecksum(buf1)).toBe(await computeChecksum(buf2));
  });
});