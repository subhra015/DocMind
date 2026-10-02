import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthError } from "@/lib/errors/classes";
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  // MUST have await here
  const supabase = await createSupabaseServerClient(); 
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError("Authentication required.", {
      code: "UNAUTHENTICATED",
    });
  }
  return user;
}

export async function getSession() {
  // MUST have await here
  const supabase = await createSupabaseServerClient(); 
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}