/**
 * Shared env helpers for Supabase clients.
 * Public values may be read on client and server; service role is server-only.
 */

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function readRequired(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/** Public Supabase URL + anon/publishable key (safe for the browser). */
export function getSupabasePublicEnv(env: NodeJS.ProcessEnv = process.env): SupabasePublicEnv {
  const url = readRequired("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);

  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    url,
    anonKey: readRequired(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
      anonKey,
    ),
  };
}

/** Service role key — never expose to the browser. */
export function getSupabaseServiceRoleKey(env: NodeJS.ProcessEnv = process.env): string {
  return readRequired("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);
}
