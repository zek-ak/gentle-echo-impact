// Bridge module that mirrors the source repo's API
// (createSupabaseClient / getSupabaseClient / initializeSupabaseClient)
// while delegating to the project's auto-generated Supabase client.
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "../auth";

export function initializeSupabaseClient(): void {
  // The auto-generated client manages its own session via localStorage.
  // We additionally inject our custom session token so RLS calls authenticate
  // as the right user when the app uses the legacy phone-OTP session model.
  try {
    const session = getSession();
    if (session?.access_token && typeof window !== "undefined") {
      // Best-effort: set session for SDK auth.* helpers. Edge functions read
      // their own access_token from request headers, so this is mostly a no-op.
      (supabase.auth as any)
        .setSession?.({ access_token: session.access_token, refresh_token: "" })
        .catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function getSupabaseClient(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export function createSupabaseClient(_accessToken?: string): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
