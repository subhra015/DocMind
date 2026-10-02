export const DocumentStatusEnum = {
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
  DELETED: "deleted",
} as const;

export type DocumentStatus =
  (typeof DocumentStatusEnum)[keyof typeof DocumentStatusEnum];

export interface DocumentRow {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  checksum: string | null;
  total_pages: number | null;
  status: DocumentStatus;
  processing_stage: string | null;
  processing_progress: number;
  error_message: string | null;
  retry_count: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  page_number: number;
  chunk_index: number;
  token_count: number | null;
  character_count: number | null;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  sources: CitationSource[];
  token_usage: TokenUsage | null;
  created_at: string;
}

export interface CitationSource {
  documentId: string;
  filename: string;
  pageNumber: number;
  chunkId: string;
  excerpt: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}