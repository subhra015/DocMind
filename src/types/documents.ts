import type { DocumentRow } from "./index";

export type DocumentDTO = DocumentRow;

export interface DocumentsListParams {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "created_at" | "file_size" | "total_pages";
  sortDir?: "asc" | "desc";
}

export interface CreateDocumentInput {
  filename: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
}

export interface DocumentStats {
  total: number;
  ready: number;
  processing: number;
  failed: number;
  queued: number;
  totalStorageMb: number;
}