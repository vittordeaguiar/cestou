import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

/**
 * Privileged Supabase client (service role).
 * Use only in trusted server code when RLS cannot cover the operation.
 */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
