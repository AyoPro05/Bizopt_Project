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
