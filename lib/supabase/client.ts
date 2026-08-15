import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

/** Supabase client for Client Components (browser). */
export function createClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();

  return createBrowserClient(url, anonKey);
}
