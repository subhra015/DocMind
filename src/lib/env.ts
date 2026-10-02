import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Gemini
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().default(768),

  // Storage
  SUPABASE_STORAGE_BUCKET: z.string().default("documents"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  MAX_DOCUMENT_PAGES: z.coerce.number().default(500),

  // Chunking
  MAX_CHUNK_CHARACTERS: z.coerce.number().default(1600),
  CHUNK_OVERLAP_CHARACTERS: z.coerce.number().default(250),
  DEFAULT_RETRIEVAL_COUNT: z.coerce.number().default(8),
  SIMILARITY_THRESHOLD: z.coerce.number().default(0.25),

  // Inngest
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Upstash
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Rate limits
  MAX_UPLOADS_PER_HOUR: z.coerce.number().default(20),
  MAX_CHAT_REQUESTS_PER_MINUTE: z.coerce.number().default(30),
  MAX_RETRIES_PER_HOUR: z.coerce.number().default(10),

  // Sentry (optional)
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

function validateEnv() {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return serverSchema.parse({} as Record<string, string>);
  }

  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)
    );
    throw new Error("Invalid environment variables. Check server logs.");
  }

  return parsed.data;
}

let _env: z.infer<typeof serverSchema> | null = null;

export function env() {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}