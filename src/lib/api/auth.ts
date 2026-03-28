import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "./types";

export interface AuthedContext {
  user: { id: string };
  profile: { role: UserRole; team_id: string | null };
  supabase: SupabaseClient;
}

/**
 * Resolves the current user and their profile from the session cookie.
 * Returns null if the request is unauthenticated or the profile is missing.
 * Callers are responsible for returning the appropriate error response.
 */
export async function getAuthContext(): Promise<AuthedContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, team_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  return { user, profile, supabase };
}

/** Convenience: resolves auth and asserts admin role. Returns null if either fails. */
export async function getAdminContext(): Promise<AuthedContext | null> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.profile.role !== "admin") return null;
  return ctx;
}
