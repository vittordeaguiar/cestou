import { getSafeNext } from "@/lib/auth/redirect";

export const AUTH_HOME_PATH = "/app";
export const LOGIN_PATH = "/auth/login";
export const SIGN_UP_PATH = "/auth/sign-up";

export type AuthNavigation =
  { type: "next" } | { type: "redirect"; location: string } | { type: "not-found" };

type ResolveAuthNavigationInput = {
  pathname: string;
  search?: string;
  isAuthenticated: boolean;
  nodeEnv?: string;
};

function matchesPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return matchesPath(pathname, "/profile") || matchesPath(pathname, "/app");
}

export function isAuthGuestPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === SIGN_UP_PATH;
}

export function isDesignSystemPath(pathname: string): boolean {
  return matchesPath(pathname, "/design-system");
}

/**
 * Builds a relative destination (pathname + search) and sanitizes it so it can
 * safely become the `next` query value on the login page.
 */
export function buildLoginRedirectPath(pathname: string, search = ""): string {
  const candidate = `${pathname}${search.startsWith("?") || search === "" ? search : `?${search}`}`;

  return getSafeNext(candidate, AUTH_HOME_PATH);
}

export function buildLoginUrl(pathname: string, search = ""): string {
  const next = buildLoginRedirectPath(pathname, search);
  const params = new URLSearchParams({ next });

  return `${LOGIN_PATH}?${params.toString()}`;
}

/**
 * Pure route matrix for the auth proxy. Session refresh stays in updateSession;
 * this only decides whether to continue, redirect, or 404.
 */
export function resolveAuthNavigation({
  pathname,
  search = "",
  isAuthenticated,
  nodeEnv = process.env.NODE_ENV,
}: ResolveAuthNavigationInput): AuthNavigation {
  if (isDesignSystemPath(pathname) && nodeEnv === "production") {
    return { type: "not-found" };
  }

  if (isProtectedPath(pathname) && !isAuthenticated) {
    return { type: "redirect", location: buildLoginUrl(pathname, search) };
  }

  if (isAuthGuestPath(pathname) && isAuthenticated) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const next = getSafeNext(params.get("next"), AUTH_HOME_PATH);

    return { type: "redirect", location: next };
  }

  return { type: "next" };
}
