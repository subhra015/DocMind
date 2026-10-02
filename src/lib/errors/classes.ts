export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly requestId?: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    options: {
      code: string;
      statusCode: number;
      userMessage: string;
      requestId?: string;
      isOperational?: boolean;
      cause?: Error;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.userMessage = options.userMessage;
    this.requestId = options.requestId;
    this.isOperational = options.isOperational ?? true;
  }
}

export class AuthError extends AppError {
  constructor(
    message: string,
    options: {
      code?: string;
      userMessage?: string;
      requestId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: options.code ?? "AUTH_ERROR",
      statusCode: 401,
      userMessage: options.userMessage ?? "Authentication required.",
      requestId: options.requestId,
      cause: options.cause,
    });
    this.name = "AuthError";
  }
}

export class DocumentError extends AppError {
  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      userMessage?: string;
      requestId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: options.code ?? "DOCUMENT_ERROR",
      statusCode: options.statusCode ?? 400,
      userMessage: options.userMessage ?? "Document operation failed.",
      requestId: options.requestId,
      cause: options.cause,
    });
    this.name = "DocumentError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    options: {
      code?: string;
      userMessage?: string;
      requestId?: string;
      cause?: Error;
    } = {}
  ) {
    super(message, {
      code: options.code ?? "VALIDATION_ERROR",
      statusCode: 400,
      userMessage: options.userMessage ?? "Invalid input.",
      requestId: options.requestId,
      cause: options.cause,
    });
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    message: string,
    options: {
      retryAfter: number;
      userMessage?: string;
      requestId?: string;
    }
  ) {
    super(message, {
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
      userMessage:
        options.userMessage ??
        "Too many requests. Please try again later.",
      requestId: options.requestId,
    });
    this.name = "RateLimitError";
    this.retryAfter = options.retryAfter;
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string,
    options: {
      code?: string;
      userMessage?: string;
      requestId?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? "NOT_FOUND",
      statusCode: 404,
      userMessage: options.userMessage ?? "The requested resource was not found.",
      requestId: options.requestId,
    });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    options: {
      code?: string;
      userMessage?: string;
      requestId?: string;
    } = {}
  ) {
    super(message, {
      code: options.code ?? "CONFLICT",
      statusCode: 409,
      userMessage: options.userMessage ?? "A conflict occurred.",
      requestId: options.requestId,
    });
    this.name = "ConflictError";
  }
}