import { describe, expect, it } from "vitest";

import {
  AUTH_HOME_PATH,
  LOGIN_PATH,
  buildLoginRedirectPath,
  buildLoginUrl,
  isAuthGuestPath,
  isDesignSystemPath,
  isProtectedPath,
  resolveAuthNavigation,
} from "@/lib/auth/routes";

describe("auth route helpers", () => {
  it("classifies protected, guest-auth, and design-system paths", () => {
    expect(isProtectedPath("/profile")).toBe(true);
    expect(isProtectedPath("/profile/settings")).toBe(true);
    expect(isProtectedPath("/app")).toBe(true);
    expect(isProtectedPath("/app/grupos/123")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/auth/login")).toBe(false);

    expect(isAuthGuestPath("/auth/login")).toBe(true);
    expect(isAuthGuestPath("/auth/sign-up")).toBe(true);
    expect(isAuthGuestPath("/auth/callback")).toBe(false);

    expect(isDesignSystemPath("/design-system")).toBe(true);
    expect(isDesignSystemPath("/design-system/buttons")).toBe(true);
  });

  it("builds a safe login redirect with the original destination", () => {
    expect(buildLoginRedirectPath("/app/grupos/123")).toBe("/app/grupos/123");
    expect(buildLoginRedirectPath("/app/grupos/123", "?tab=items")).toBe(
      "/app/grupos/123?tab=items",
    );
    expect(buildLoginUrl("/app/grupos/123")).toBe(
      `${LOGIN_PATH}?next=${encodeURIComponent("/app/grupos/123")}`,
    );
    expect(buildLoginRedirectPath("https://attacker.example")).toBe(AUTH_HOME_PATH);
  });

  it("sends anonymous users from protected routes to login", () => {
    expect(
      resolveAuthNavigation({
        pathname: "/app/grupos/123",
        search: "?tab=items",
        isAuthenticated: false,
      }),
    ).toEqual({
      type: "redirect",
      location: `${LOGIN_PATH}?next=${encodeURIComponent("/app/grupos/123?tab=items")}`,
    });

    expect(
      resolveAuthNavigation({
        pathname: "/profile",
        isAuthenticated: false,
      }),
    ).toEqual({
      type: "redirect",
      location: `${LOGIN_PATH}?next=${encodeURIComponent("/profile")}`,
    });
  });

  it("sends authenticated users away from login and sign-up", () => {
    expect(
      resolveAuthNavigation({
        pathname: "/auth/login",
        isAuthenticated: true,
      }),
    ).toEqual({ type: "redirect", location: AUTH_HOME_PATH });

    expect(
      resolveAuthNavigation({
        pathname: "/auth/sign-up",
        search: "?next=/app/grupos/123",
        isAuthenticated: true,
      }),
    ).toEqual({ type: "redirect", location: "/app/grupos/123" });

    expect(
      resolveAuthNavigation({
        pathname: "/auth/login",
        search: "?next=https://attacker.example",
        isAuthenticated: true,
      }),
    ).toEqual({ type: "redirect", location: AUTH_HOME_PATH });
  });

  it("blocks the design system only in production", () => {
    expect(
      resolveAuthNavigation({
        pathname: "/design-system",
        isAuthenticated: false,
        nodeEnv: "production",
      }),
    ).toEqual({ type: "not-found" });

    expect(
      resolveAuthNavigation({
        pathname: "/design-system",
        isAuthenticated: false,
        nodeEnv: "development",
      }),
    ).toEqual({ type: "next" });
  });

  it("leaves public and technical auth routes alone", () => {
    expect(
      resolveAuthNavigation({
        pathname: "/",
        isAuthenticated: false,
      }),
    ).toEqual({ type: "next" });

    expect(
      resolveAuthNavigation({
        pathname: "/auth/callback",
        isAuthenticated: false,
      }),
    ).toEqual({ type: "next" });

    expect(
      resolveAuthNavigation({
        pathname: "/app",
        isAuthenticated: true,
      }),
    ).toEqual({ type: "next" });
  });
});
