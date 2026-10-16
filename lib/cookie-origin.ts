// Cookie-authenticated API mutations must be same-origin, even when a caller
// supplies an arbitrary Authorization header alongside its cookies.
export function cookieMutationOriginAllowed(req: Request, expectedOrigin?: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const path = new URL(req.url).pathname;
  if (path.startsWith("/api/auth/") || path === "/api/stripe/webhook") return true;
  if (!/(?:^|;\s*)(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/.test(req.headers.get("cookie") ?? "")) return true;
  try { return req.headers.get("origin") === new URL(expectedOrigin ?? req.url).origin; }
  catch { return false; }
}
