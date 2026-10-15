export function isPrivateIdentityPath(value: string) {
  try {
    const path = new URL(value, "https://privacy.invalid").pathname;
    return /^\/(verify-email|reset-password|forgot-password|check-email)(\/|$)/.test(path) || /^\/api\/(auth\/(signup|verify-email|verification|password-reset)|account\/(password|email))(\/|$)/.test(path) || path === "/notifications/unsubscribe";
  } catch { return true; }
}
export function shouldDropIdentityTelemetry(event: { request?: { url?: string } }) {
  return !!event.request?.url && isPrivateIdentityPath(event.request.url);
}
