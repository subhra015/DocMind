import { z } from "zod";
import { DocumentError } from "@/lib/errors/classes";

const ALLOWED_EXTENSIONS = new Set(["pdf"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);

const ALLOWED_FILENAME = /^[\w\s.-]+\.pdf$/i;

export interface FileValidationConfig {
  maxBytes: number;
}

export const DEFAULT_FILE_VALIDATION_CONFIG: FileValidationConfig = {
  maxBytes: 50 * 1024 * 1024,
};

export class ScannedPdfError extends DocumentError {
  constructor() {
    super("Scanned or image-only PDF detected.", {
      code: "PDF_REQUIRES_OCR",
      userMessage:
        "This PDF appears to be scanned and contains no extractable text. OCR is not supported yet.",
    });
    this.name = "ScannedPdfError";
  }
}

export function hasPdfMagicBytes(buffer: Uint8Array): boolean {
  if (buffer.length < 5) return false;
  const prefix = new TextDecoder().decode(buffer.slice(0, 5));
  return prefix === "%PDF-";
}

export function isPdfExtension(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return ALLOWED_EXTENSIONS.has(ext);
}

export function isValidMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

export function checkFilename(filename: string): string {
  if (!filename || !filename.trim()) {
    throw new DocumentError("Filename is required.", {
      code: "EMPTY_FILENAME",
      userMessage: "A filename is required.",
    });
  }

  if (filename.length > 255) {
    throw new DocumentError("Filename is too long.", {
      code: "INVALID_FILENAME",
      userMessage: "The filename is too long.",
    });
  }

  if (!ALLOWED_FILENAME.test(filename)) {
    throw new DocumentError("Filename rejected.", {
      code: "INVALID_FILENAME",
      userMessage: "The filename contains unsupported characters.",
    });
  }

  if (!isPdfExtension(filename)) {
    throw new DocumentError("Unsupported file type.", {
      code: "UNSUPPORTED_FILE_TYPE",
      userMessage: "Only PDF files are supported.",
    });
  }

  return filename.trim();
}

export function validateFileMetadata(input: {
  filename: string;
  fileSize: number;
  mimeType: string;
  config?: FileValidationConfig;
}): void {
  const config = input.config ?? DEFAULT_FILE_VALIDATION_CONFIG;

  checkFilename(input.filename);

  if (!isValidMimeType(input.mimeType)) {
    throw new DocumentError("Unsupported MIME type.", {
      code: "UNSUPPORTED_FILE_TYPE",
      userMessage: "Only PDF files are supported.",
    });
  }

  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    throw new DocumentError("Empty file.", {
      code: "EMPTY_FILE",
      userMessage: "The uploaded file is empty.",
    });
  }

  if (input.fileSize > config.maxBytes) {
    throw new DocumentError("File too large.", {
      code: "FILE_TOO_LARGE",
      userMessage: `The file exceeds the ${Math.round(
        config.maxBytes / (1024 * 1024)
      )}MB limit.`,
    });
  }
}

export function computeChecksum(buffer: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", buffer).then((hash) => {
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

export function validatePdfBuffer(
  buffer: Uint8Array,
  config?: FileValidationConfig
): void {
  const cfg = config ?? DEFAULT_FILE_VALIDATION_CONFIG;

  if (buffer.length === 0) {
    throw new DocumentError("Empty file.", {
      code: "EMPTY_FILE",
      userMessage: "The uploaded file is empty.",
    });
  }

  if (buffer.length > cfg.maxBytes) {
    throw new DocumentError("File too large.", {
      code: "FILE_TOO_LARGE",
      userMessage: `The file exceeds the ${Math.round(
        cfg.maxBytes / (1024 * 1024)
      )}MB limit.`,
    });
  }

  if (!hasPdfMagicBytes(buffer)) {
    throw new DocumentError("Not a valid PDF.", {
      code: "INVALID_PDF",
      userMessage: "The file is not a valid PDF.",
    });
  }
}

export const createDocumentSchema = z.object({
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  checksum: z.string().length(64).optional(),
});