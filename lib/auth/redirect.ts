const DEFAULT_POST_AUTH_PATH = "/profile";

/**
 * Keeps navigation inside this application. Browser and server callers share
 * the same rule so an untrusted `next` value can never become an open redirect.
 */
export function getSafeNext(value: unknown, fallback = DEFAULT_POST_AUTH_PATH): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.includes("\\") || /[\u0000-\u001F\u007F]/.test(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://cestou.invalid");

    return parsed.origin === "https://cestou.invalid" ? value : fallback;
  } catch {
    return fallback;
  }
}

export { DEFAULT_POST_AUTH_PATH };
