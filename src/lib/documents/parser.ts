import { PDFParse } from "pdf-parse";
import { DocumentError } from "@/lib/errors/classes";
import { validatePdfBuffer } from "./validation";
import { logger } from "@/lib/observability/logger";

export interface PageContent {
  pageNumber: number;
  content: string;
}

export interface ParseResult {
  pages: PageContent[];
  totalPages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    created?: string;
    modified?: string;
  };
  isScanned: boolean;
}

export interface ParseOptions {
  minTextCharactersThreshold?: number;
}

const DEFAULT_MIN_TEXT_THRESHOLD = 10;
const SCANNED_PAGE_RATIO = 0.75;

/**
 * Detects if text content is too short to be usable — a strong signal
 * that a page is scanned (image-only).
 */
function isLikelyScannedPage(text: string, threshold: number): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length < threshold;
}

export async function parsePdf(
  options: { data: Uint8Array },
  parseOptions: ParseOptions = {}
): Promise<ParseResult> {
  validatePdfBuffer(options.data);

  const threshold =
    parseOptions.minTextCharactersThreshold ?? DEFAULT_MIN_TEXT_THRESHOLD;

  let parser: PDFParse | undefined;

  try {
    logger.debug("parsing pdf", { bytes: options.data.length });

    parser = new PDFParse({ data: options.data });

    const infoResult = await parser.getInfo();
    const textResult = await parser.getText();

    const pages: PageContent[] = textResult.pages.map((page) => ({
      pageNumber: page.num,
      content: page.text,
    }));

    let scannedPages = 0;
    for (const page of pages) {
      if (isLikelyScannedPage(page.content, threshold)) {
        scannedPages += 1;
      }
    }

    const isScanned =
      pages.length > 0 &&
      scannedPages / pages.length >= SCANNED_PAGE_RATIO;

    return {
      pages,
      totalPages: textResult.total,
      metadata: {
        title: infoResult.infoData?.Title,
        author: infoResult.infoData?.Author,
        creator: infoResult.infoData?.Creator,
        created: infoResult.infoData?.CreationDate,
        modified: infoResult.infoData?.ModDate,
      },
      isScanned,
    };
  } catch (error) {
    if (error instanceof DocumentError) {
      throw error;
    }
    logger.error("pdf parse failed", { errorCode: "PDF_PARSE_FAILED" });
    throw new DocumentError("Failed to parse the PDF file.", {
      code: "PDF_PARSE_FAILED",
      userMessage: "The PDF could not be parsed. It may be corrupt.",
      cause: error as Error,
    });
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // best-effort cleanup
      }
    }
  }
}