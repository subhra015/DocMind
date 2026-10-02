import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { DocumentError } from "@/lib/errors/classes";

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: env().GEMINI_API_KEY });
  }
  return _client;
}

export interface EmbeddingConfig {
  model: string;
  dimensions: number;
}

export function getEmbeddingConfig(): EmbeddingConfig {
  const e = env();
  return {
    model: e.GEMINI_EMBEDDING_MODEL,
    dimensions: e.GEMINI_EMBEDDING_DIMENSIONS,
  };
}

const EMBEDDING_BATCH_SIZE = 96;
const MAX_EMBEDDING_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EmbeddingResult {
  vector: number[];
  usedTokens: number;
}

/**
 * Generates embeddings for a list of texts in batches, with per-batch
 * retry + exponential backoff. Throws after exhausting retries so callers
 * can keep the document in a recoverable failed state.
 */
export async function embedTexts(
  texts: string[],
  config?: EmbeddingConfig
): Promise<EmbeddingResult[]> {
  const cfg = config ?? getEmbeddingConfig();
  const ai = getGeminiClient();

  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    let lastError: unknown;
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_EMBEDDING_RETRIES; attempt++) {
      try {
        const started = Date.now();
        const response = await ai.models.embedContent({
          model: cfg.model,
          contents: batch,
          config: {
            outputDimensionality: cfg.dimensions,
            taskType: "RETRIEVAL_DOCUMENT",
          },
        });

        const embeddings = (response.embeddings ?? []).map(
          (e) => e.values ?? []
        );

        if (embeddings.length !== batch.length) {
          throw new DocumentError("Embedding count mismatch.", {
            code: "EMBEDDING_MISMATCH",
            userMessage: "Embedding generation returned an unexpected result.",
          });
        }

        const usedTokens =
          response.usageMetadata?.totalTokens ?? batch.length * 128;

        logger.debug("embedding batch complete", {
          batchSize: batch.length,
          durationMs: Date.now() - started,
          usedTokens,
        });

        for (const vector of embeddings) {
          results.push({ vector, usedTokens });
        }

        succeeded = true;
        break;
      } catch (error) {
        lastError = error;
        const isRateLimit = (error as { status?: number })?.status === 429;

        if (attempt < MAX_EMBEDDING_RETRIES) {
          const backoff =
            BASE_BACKOFF_MS * Math.pow(2, attempt - 1) +
            Math.random() * 500;
          logger.warn("embedding attempt failed, retrying", {
            attempt,
            backoffMs: Math.round(backoff),
            isRateLimit,
          });
          await sleep(isRateLimit ? Math.max(backoff, 2000) : backoff);
        }
      }
    }

    if (!succeeded) {
      logger.error("embedding exhausted retries", {
        errorCode: "EMBEDDING_FAILED",
      });
      throw new DocumentError("Embedding generation failed.", {
        code: "EMBEDDING_FAILED",
        userMessage: "We could not embed this document. Please retry.",
        cause: lastError as Error,
      });
    }
  }

  return results;
}