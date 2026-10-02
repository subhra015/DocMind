import { AppError, ValidationError, RateLimitError } from "./classes";
import { generateRequestId } from "../utils";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function handleApiError(
  error: unknown,
  requestId?: string
): NextResponse {
  const reqId = requestId ?? generateRequestId();

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: error.code, message: error.userMessage },
        requestId: reqId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": error.retryAfter.toString(),
        },
      }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: error.code, message: error.userMessage },
        requestId: reqId,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const message = error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "VALIDATION_ERROR", message },
        requestId: reqId,
      },
      { status: 400 }
    );
  }

  console.error("[ERROR] Unhandled error:", error);

  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
      requestId: reqId,
    },
    { status: 500 }
  );
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  requestId?: string
) {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code, message },
      requestId: requestId ?? generateRequestId(),
    },
    { status }
  );
}

export function createSuccessResponse<T>(
  data: T,
  requestId?: string,
  status: number = 200
) {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
      requestId: requestId ?? generateRequestId(),
    },
    { status }
  );
}