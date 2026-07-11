import { describe, expect, it } from "vitest";

import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/supabase/env";

describe("getSupabasePublicEnv", () => {
  it("returns url and anon key when configured", () => {
    expect(
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("falls back to the publishable key when anon key is missing", () => {
    expect(
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }).anonKey,
    ).toBe("publishable-key");
  });

  it("throws when the public url is missing", () => {
    expect(() =>
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("getSupabaseServiceRoleKey", () => {
  it("returns the service role key when configured", () => {
    expect(
      getSupabaseServiceRoleKey({
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toBe("service-role-key");
  });

  it("throws when the service role key is missing", () => {
    expect(() => getSupabaseServiceRoleKey({})).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
