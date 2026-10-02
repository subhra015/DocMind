import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  const e = env();
  if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!_redis) {
    _redis = new Redis({
      url: e.UPSTASH_REDIS_REST_URL,
      token: e.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

let _uploadLimiter: Ratelimit | null = null;
let _chatLimiter: Ratelimit | null = null;
let _retryLimiter: Ratelimit | null = null;

/**
 * Returns an Upstash-backed rate limiter, or null when Upstash is
 * not configured (local development fallback).
 */
export function getRateLimiter(category: "upload" | "chat" | "retry") {
  const e = env();
  const redis = getRedis();
  if (!redis) {
    return null;
  }

  switch (category) {
    case "upload":
      if (!_uploadLimiter) {
        _uploadLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(e.MAX_UPLOADS_PER_HOUR, "1 h"),
          prefix: "ratelimit:upload",
          analytics: true,
        });
      }
      return _uploadLimiter;
    case "chat":
      if (!_chatLimiter) {
        _chatLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(e.MAX_CHAT_REQUESTS_PER_MINUTE, "1 m"),
          prefix: "ratelimit:chat",
          analytics: true,
        });
      }
      return _chatLimiter;
    case "retry":
      if (!_retryLimiter) {
        _retryLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(e.MAX_RETRIES_PER_HOUR, "1 h"),
          prefix: "ratelimit:retry",
          analytics: true,
        });
      }
      return _retryLimiter;
  }
}

export type RateLimitCheck = {
  success: boolean;
  remaining: number;
  reset: number;
};

export async function checkRateLimit(
  category: "upload" | "chat" | "retry",
  identifier: string
): Promise<RateLimitCheck | null> {
  const limiter = getRateLimiter(category);
  if (!limiter) return null;

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}