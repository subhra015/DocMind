import { inngest } from "@/inngest/client";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { downloadDocument } from "@/lib/storage/client";
import { parsePdf, type ParseResult } from "@/lib/documents/parser";
import {
  chunkDocument,
  DEFAULT_CHUNKER_OPTIONS,
} from "@/lib/documents/chunker";
import {
  embedTexts,
  getEmbeddingConfig,
} from "@/lib/embeddings/gemini";
import { ScannedPdfError } from "@/lib/documents/validation";
import { DocumentError } from "@/lib/errors/classes";
import { logger } from "@/lib/observability/logger";
import { env } from "@/lib/env";
import type { DocumentRow } from "@/types";

const STAGES = [
  "downloading",
  "validating",
  "parsing",
  "chunking",
  "embedding",
  "storing",
  "complete",
] as const;

type Stage = (typeof STAGES)[number];

async function updateDocument(
  supabase: any,
  documentId: string,
  userId: string,
  patch: any
) {
  const { error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) {
    logger.error("failed to update document", {
      documentId,
      errorCode: error.code ?? "DB_UPDATE_FAILED",
    });
    throw new Error(`DB update failed for document ${documentId}`);
  }
}

function stageToProgress(stage: Stage): number {
  switch (stage) {
    case "downloading":
      return 10;
    case "validating":
      return 20;
    case "parsing":
      return 40;
    case "chunking":
      return 55;
    case "embedding":
      return 75;
    case "storing":
      return 90;
    case "complete":
      return 100;
    default:
      return 5;
  }
}

async function loadDocument(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  documentId: string,
  userId: string
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new DocumentError("Document not found.", {
      code: "DOCUMENT_NOT_FOUND",
      userMessage: "The document no longer exists.",
    });
  }

  return data as DocumentRow;
}

export const processDocument = inngest.createFunction(
  {
    id: "process-document",
    name: "Process Document",
    triggers: { event: "document/process" },
    retries: 2,
    concurrency: 4,
    cancelOn: [
      {
        event: "document/deleted",
        match: "data.documentId",
      },
    ],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { documentId, userId } = event.data;
    const e = env();

    const chunkerOptions = {
      maxChunkCharacters: e.MAX_CHUNK_CHARACTERS,
      overlapCharacters: e.CHUNK_OVERLAP_CHARACTERS,
    };

    await step.run("mark-processing", async () => {
      const supabase = createSupabaseServiceClient();
      await updateDocument(supabase, documentId, userId, {
        status: "processing",
        processing_stage: STAGES[0],
        processing_progress: stageToProgress("downloading"),
        error_message: null,
        processing_started_at: new Date().toISOString(),
      });
    });

    // Step 1-2: download + validate
    // ✅ FIX: We no longer return the buffer. We just validate it exists.
    await step.run("download-and-validate", async () => {
      const supabase = createSupabaseServiceClient();
      const doc = await loadDocument(supabase, documentId, userId);

      // Just check that the file exists in storage
      if (!doc.storage_path) {
        throw new DocumentError("Missing storage path.", {
          code: "MISSING_STORAGE_PATH",
          userMessage: "The document file is missing.",
        });
      }

      await updateDocument(supabase, documentId, userId, {
        processing_stage: "validating",
        processing_progress: stageToProgress("validating"),
      });

      return { valid: true };
    });

    // Step 3: parse
    const parseResult = await step.run("parse", async () => {
      const supabase = createSupabaseServiceClient();
      await updateDocument(supabase, documentId, userId, {
        processing_stage: "parsing",
        processing_progress: stageToProgress("parsing"),
      });

      // ✅ FIX: Re-download the file directly in this step to get a real Buffer
      const doc = await loadDocument(supabase, documentId, userId);
      const buffer = await downloadDocument(doc.storage_path);

      const parsed = await parsePdf({ data: buffer });

      if (parsed.totalPages > e.MAX_DOCUMENT_PAGES) {
        throw new DocumentError("Too many pages.", {
          code: "TOO_MANY_PAGES",
          userMessage: `Documents may not exceed ${e.MAX_DOCUMENT_PAGES} pages.`,
        });
      }

      if (parsed.isScanned) {
        throw new ScannedPdfError();
      }

      await updateDocument(supabase, documentId, userId, {
        total_pages: parsed.totalPages,
      });

      return { parsed };
    });
    const parsed = parseResult.parsed;

    // Step 4-5: chunk + embed
    const chunkResult = await step.run("chunk", async () => {
      const supabase = createSupabaseServiceClient();
      await updateDocument(supabase, documentId, userId, {
        processing_stage: "chunking",
        processing_progress: stageToProgress("chunking"),
      });

      const pages = parsed.pages.map((p: any) => ({
        pageNumber: p.pageNumber,
        content: p.content,
      }));

      const chunks = chunkDocument(pages, documentId, userId, chunkerOptions);

      if (chunks.length === 0) {
        throw new ScannedPdfError();
      }

      return { chunks };
    });
    const chunks = chunkResult.chunks;

    const embedResult = await step.run("embed", async () => {
      const supabase = createSupabaseServiceClient();
      await updateDocument(supabase, documentId, userId, {
        processing_stage: "embedding",
        processing_progress: stageToProgress("embedding"),
      });

      const texts = chunks.map((c: any) => c.content);
      const results = await embedTexts(texts, getEmbeddingConfig());
      const embeddings = results.map((r) => r.vector);

      return { embeddings };
    });
    const embeddings = embedResult.embeddings;

    // Step 6: store
    await step.run("store", async () => {
      const supabase = createSupabaseServiceClient();
      await updateDocument(supabase, documentId, userId, {
        processing_stage: "storing",
        processing_progress: stageToProgress("storing"),
      });

      await supabase
        .from("chunks")
        .delete()
        .eq("document_id", documentId)
        .eq("user_id", userId);

      const rows = chunks.map((chunk: any) => ({
        document_id: chunk.document_id,
        user_id: chunk.user_id,
        content: chunk.content,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
        token_count: chunk.token_count,
        character_count: chunk.character_count,
        metadata: chunk.metadata,
        embedding: embeddings[chunk.chunk_index] ?? [],
      }));

      const { error } = await supabase
        .from("chunks")
        .insert(rows as any);

      if (error) {
        logger.error("failed to store chunks", {
          documentId,
          errorCode: error.code ?? "CHUNK_STORE_FAILED",
        });
        throw new Error(`Failed to store chunks: ${error.message}`);
      }

      return { stored: rows.length };
    });

    // Step 7: complete
    await step.run("complete", async () => {
      const supabase = createSupabaseServiceClient();
      await updateDocument(supabase, documentId, userId, {
        status: "ready",
        processing_stage: "complete",
        processing_progress: 100,
        processing_completed_at: new Date().toISOString(),
        error_message: null,
      });
    });

    return { status: "ready" };
  }
);
