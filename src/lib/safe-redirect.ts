/**
 * Guards against open-redirect via a user-controlled `callbackUrl` query
 * param: only ever returns a same-app relative path, never an absolute URL
 * or a protocol-relative one (`//evil.com` is parsed as an absolute URL by
 * browsers/redirects too).
 */
export function safeRedirectPath(candidate: string | undefined | null, fallback: string): string {
  if (!candidate) return fallback;
  // Must start with exactly one "/" (relative, app-rooted) — rejects
  // absolute URLs ("https://..."), protocol-relative ones ("//evil.com"),
  // and anything else that isn't unambiguously same-origin.
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  // Backslashes are treated as forward slashes by some browsers, so
  // "/\evil.com" can behave like "//evil.com" — reject those too.
  if (candidate.includes("\\")) return fallback;
  return candidate;
}
