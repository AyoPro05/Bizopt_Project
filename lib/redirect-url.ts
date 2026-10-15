export function isAllowedAppRedirect(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const target = new URL(url);
    const allowed = new URL(base);
    return target.origin === allowed.origin;
  } catch {
    return false;
  }
}

export function safeInternalDestination(raw: string | null, origin: string, fallback = "/ai-studio"): string {
  if (!raw || raw.includes("\\") || raw.startsWith("//")) return fallback;
  try {
    const target = new URL(raw, origin);
    if (target.origin !== new URL(origin).origin || !target.pathname.startsWith("/") || /^\/(api|login|signup|device-check)(\/|$)/.test(target.pathname)) return fallback;
    return `${target.pathname}${target.search}`;
  } catch { return fallback; }
}
