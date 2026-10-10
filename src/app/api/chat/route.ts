import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/errors/handlers";
import { generateRequestId } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit/client";
import { RateLimitError, DocumentError } from "@/lib/errors/classes";
import {
  embedTexts,
  getEmbeddingConfig,
  getGeminiClient,
} from "@/lib/embeddings/gemini";
import {
  hybridSearchChunks,
  matchChunks,
  type MatchResult,
} from "@/lib/rag/retrieval";
import { rerankChunks } from "@/lib/rag/rerank";
import { buildRAGPrompt } from "@/lib/rag/prompt";
import { parseCitations } from "@/lib/rag/citations";
import { env } from "@/lib/env";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";

const chatSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(5000),
  documentId: z.string().uuid().nullable().optional(),
  pipeline: z.enum(["vector", "hybrid"]).optional().default("hybrid"),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  try {
    const user = await requireUser();

    // Rate limit
    const rateResult = await checkRateLimit("chat", user.id);
    if (rateResult && !rateResult.success) {
      const retryAfter = Math.ceil((rateResult.reset - Date.now()) / 1000);
      throw new RateLimitError("Too many chat requests.", { retryAfter });
    }

    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return handleApiError(parsed.error, requestId);
    }

    const { conversationId, message, documentId, pipeline } = parsed.data;

    const supabase = createSupabaseServiceClient();
    const db = supabase as any;

    // Verify conversation belongs to user
    const { data: conv, error: convError } = await db
      .from("conversations")
      .select("id, user_id, document_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (convError || !conv) {
      return handleApiError(
        new DocumentError("Conversation not found.", {
          code: "CONVERSATION_NOT_FOUND",
          userMessage: "The conversation does not exist.",
        }),
        requestId
      );
    }

    // Store user message
    const { error: userMsgError } = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: message,
        sources: [],
      })
      .select()
      .single();

    if (userMsgError) throw userMsgError;

    // Generate query embedding
    const embeddingResults = await embedTexts([message], getEmbeddingConfig());
    const first = embeddingResults[0] as any;
    const queryEmbedding: number[] =
      first?.embedding ?? first?.vector ?? first?.values ?? [];

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new DocumentError("Query embedding failed.", {
        code: "EMBEDDING_FAILED",
        userMessage: "We could not process your question.",
      });
    }

    const searchDocumentId = documentId ?? conv.document_id;

    // Branch on pipeline for Week 4 evaluation
    let chunks: MatchResult[];

    if (pipeline === "vector") {
      // Old pipeline: vector-only search, no reranking.
      chunks = await matchChunks(
        supabase,
        queryEmbedding,
        user.id,
        searchDocumentId,
        env().DEFAULT_RETRIEVAL_COUNT,
        env().SIMILARITY_THRESHOLD
      );
    } else {
      // New pipeline: hybrid search + rerank.
      const hybridResults: MatchResult[] = await hybridSearchChunks(
        supabase,
        message,
        queryEmbedding,
        user.id,
        searchDocumentId,
        20
      );
      chunks = await rerankChunks(message, hybridResults, 5);
    }

    // Build RAG prompt
    const { systemPrompt, userPrompt, sources } = buildRAGPrompt(message, chunks);

    const ai = getGeminiClient();
    const startTime = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();

          const response = await ai.models.generateContentStream({
            model: env().GEMINI_CHAT_MODEL,
            contents: [
              { role: "user", parts: [{ text: systemPrompt }] },
              {
                role: "model",
                parts: [
                  {
                    text: "Understood. I'll answer based on the provided context.",
                  },
                ],
              },
              { role: "user", parts: [{ text: userPrompt }] },
            ],
          });

          let fullText = "";

          for await (const chunk of response) {
            const text = chunk.text ?? "";
            if (text) {
              fullText += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", data: text })}\n\n`
                )
              );
            }
          }

          const citations = parseCitations(fullText, chunks);

          const { data: assistantMessage } = await db
            .from("messages")
            .insert({
              conversation_id: conversationId,
              user_id: user.id,
              role: "assistant",
              content: fullText,
              sources: JSON.stringify(citations),
              citations: citations,
              token_usage: JSON.stringify({
                promptTokens: message.length / 4,
                completionTokens: fullText.length / 4,
                totalTokens: (message.length + fullText.length) / 4,
              }),
            })
            .select()
            .single();

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "citations", data: citations })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                data: {
                  messageId: assistantMessage?.id ?? "",
                  sources,
                },
              })}\n\n`
            )
          );

          await db
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);

          logger.info("chat response complete", {
            conversationId,
            userId: user.id,
            durationMs: Date.now() - startTime,
            chunkCount: chunks.length,
            pipeline,
          });
        } catch (err) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                data: {
                  code: "STREAM_ERROR",
                  message: "An error occurred while generating the response.",
                  requestId,
                },
              })}\n\n`
            )
          );
          logger.error("chat stream error", {
            conversationId,
            errorCode: "STREAM_ERROR",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}