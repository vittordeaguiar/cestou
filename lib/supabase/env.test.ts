import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getSupabaseBrowserEnv,
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

describe("getSupabaseBrowserEnv", () => {
  const publicEnvNames = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;
  let originalEnv: Partial<Record<(typeof publicEnvNames)[number], string>>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      publicEnvNames
        .filter((name) => process.env[name] !== undefined)
        .map((name) => [name, process.env[name]]),
    );
  });

  afterEach(() => {
    publicEnvNames.forEach((name) => {
      const value = originalEnv[name];

      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  });

  it("reads statically referenced public variables for the browser client", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(getSupabaseBrowserEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "publishable-key",
    });
  });

  it("keeps the anon key fallback for existing environments", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabaseBrowserEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
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
