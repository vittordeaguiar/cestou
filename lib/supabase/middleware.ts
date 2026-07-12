import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { resolveAuthNavigation } from "@/lib/auth/routes";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function copySessionCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });

  return to;
}

function redirectWithSession(url: URL, sessionResponse: NextResponse): NextResponse {
  return copySessionCookies(sessionResponse, NextResponse.redirect(url));
}

function notFoundWithSession(sessionResponse: NextResponse): NextResponse {
  return copySessionCookies(sessionResponse, new NextResponse(null, { status: 404 }));
}

/**
 * Refreshes Auth session cookies and enforces the authenticated route matrix.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });

        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Validates JWT / refreshes session; do not use getSession() for auth checks.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = typeof data?.claims?.sub === "string";

  const navigation = resolveAuthNavigation({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated,
  });

  if (navigation.type === "redirect") {
    return redirectWithSession(new URL(navigation.location, request.url), supabaseResponse);
  }

  if (navigation.type === "not-found") {
    return notFoundWithSession(supabaseResponse);
  }

  return supabaseResponse;
}
