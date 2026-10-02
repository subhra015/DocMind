import type {
  ConversationRow,
  MessageRow,
  CitationSource,
} from "./index";

export interface ConversationPreview extends ConversationRow {
  document_title?: string | null;
  message_count: number;
}

export interface ConversationDetail extends ConversationRow {
  messages: MessageRow[];
}

export interface CreateConversationInput {
  title?: string;
  documentId?: string | null;
}

export interface RetriableChatResult {
  conversationId: string;
  messageId: string;
}

export interface ChatRequestBody {
  conversationId: string;
  message: string;
  documentId?: string | null;
}

export interface ChatStreamEvent {
  type: "text" | "citations" | "done" | "error";
  data: string | CitationSource[] | ChatDonePayload | ChatErrorPayload;
}

export interface ChatDonePayload {
  messageId: string;
  sources: CitationSource[];
}

export interface ChatErrorPayload {
  code: string;
  message: string;
  requestId: string;
}

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  page_number: number;
  chunk_index: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface ChatStreamOptions {
  conversationId: string;
  documentId?: string | null;
}