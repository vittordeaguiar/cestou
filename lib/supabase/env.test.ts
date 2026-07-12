import { describe, expect, it } from "vitest";

import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  getSupabaseSiteUrl,
} from "@/lib/supabase/env";

describe("getSupabasePublicEnv", () => {
  it("returns url and publishable key when configured", () => {
    expect(
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "publishable-key",
    });
  });

  it("falls back to the anon key when publishable key is missing", () => {
    expect(
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }).anonKey,
    ).toBe("anon-key");
  });

  it("throws when the public url is missing", () => {
    expect(() =>
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("validates the public site URL without exposing its value", () => {
    expect(() => getSupabaseSiteUrl({})).toThrow(/NEXT_PUBLIC_SITE_URL/);

    expect(() =>
      getSupabaseSiteUrl({
        NEXT_PUBLIC_SITE_URL: "ftp://example.com",
      }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);

    expect(getSupabaseSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://cestou-kohl.vercel.app" })).toBe(
      "https://cestou-kohl.vercel.app/",
    );
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
