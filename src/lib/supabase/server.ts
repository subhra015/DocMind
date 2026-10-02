import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// 1. Made this function async
export async function createSupabaseServerClient() {
  // 2. Await the cookies() call (Next.js 15 requirement)
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // 3. Added the explicit type for cookiesToSet
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (_) {
            // Server Components cannot set cookies. Ignore.
          }
        },
      },
    }
  );
}

let _serviceRoleClient: ReturnType<typeof createClient> | null = null;

// This remains synchronous because it uses the Service Role key and does not rely on cookies
export function createSupabaseServiceClient() {
  if (!_serviceRoleClient) {
    _serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return _serviceRoleClient;
}