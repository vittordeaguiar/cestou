import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/supabase/env";

/** Supabase client for Client Components (browser). */
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createBrowserClient(url, anonKey);
}
