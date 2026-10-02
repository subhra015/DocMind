export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  requestId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DocumentUploadResponse {
  documentId: string;
  uploadUrl: string | null;
  storagePath: string;
  expiresIn: number;
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
}