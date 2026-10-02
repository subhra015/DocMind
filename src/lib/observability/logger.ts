import { hashUserId } from "../utils";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  requestId?: string;
  userId?: string;
  documentId?: string;
  conversationId?: string;
  processingStage?: string;
  durationMs?: number;
  errorCode?: string;
  statusCode?: number;
  [key: string]: unknown;
}

interface LogEntry extends LogFields {
  level: LogLevel;
  message: string;
  timestamp: string;
}

function log(level: LogLevel, message: string, fields: LogFields = {}) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  if (entry.userId && level !== "debug") {
    // Redact user identity in non-debug logs. Never log raw tokens, keys, content.
    entry.userId = hashUserId(entry.userId);
  }

  const line = JSON.stringify(entry);

  switch (level) {
    case "debug":
      if (process.env.NODE_ENV !== "production") console.debug(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
    default:
      console.info(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) =>
    log("debug", message, fields),
  info: (message: string, fields?: LogFields) =>
    log("info", message, fields),
  warn: (message: string, fields?: LogFields) =>
    log("warn", message, fields),
  error: (message: string, fields?: LogFields) =>
    log("error", message, fields),
};

export function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
  fields?: LogFields
): Promise<T> {
  const start = Date.now();
  return fn()
    .then((result) => {
      logger.debug(`completed: ${label}`, {
        durationMs: Date.now() - start,
        ...fields,
      });
      return result;
    })
    .catch((err) => {
      logger.warn(`failed: ${label}`, {
        durationMs: Date.now() - start,
        errorCode: "UNKNOWN",
        ...fields,
      });
      throw err;
    });
}