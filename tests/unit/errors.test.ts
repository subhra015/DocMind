import { describe, it, expect } from "vitest";
import {
  AppError,
  AuthError,
  DocumentError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors/classes";

describe("AppError", () => {
  it("has all required fields", () => {
    const err = new AppError("test message", {
      code: "TEST",
      statusCode: 400,
      userMessage: "user msg",
    });
    expect(err.code).toBe("TEST");
    expect(err.statusCode).toBe(400);
    expect(err.userMessage).toBe("user msg");
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe("AppError");
  });
});

describe("AuthError", () => {
  it("defaults to 401", () => {
    const err = new AuthError("unauth");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("AUTH_ERROR");
    expect(err.userMessage).toContain("Authentication");
  });
});

describe("DocumentError", () => {
  it("allows custom status code", () => {
    const err = new DocumentError("conflict", {
      statusCode: 409,
      code: "CUSTOM",
    });
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CUSTOM");
  });
});

describe("ValidationError", () => {
  it("defaults to 400", () => {
    const err = new ValidationError("invalid");
    expect(err.statusCode).toBe(400);
  });
});

describe("RateLimitError", () => {
  it("includes retryAfter", () => {
    const err = new RateLimitError("slow down", { retryAfter: 30 });
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(30);
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("NotFoundError", () => {
  it("defaults to 404", () => {
    const err = new NotFoundError("gone");
    expect(err.statusCode).toBe(404);
  });
});

describe("ConflictError", () => {
  it("defaults to 409", () => {
    const err = new ConflictError("dup");
    expect(err.statusCode).toBe(409);
  });
});