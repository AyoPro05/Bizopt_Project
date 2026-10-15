import { trustedAppUrl, validateNotificationEncryption } from "@/services/notifications/config";
export function identityAppOrigin(): string {
  const raw = process.env.APP_URL;
  if (!raw) throw new Error("APP_URL is required");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !(url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname)))) throw new Error("APP_URL must be a trusted origin");
  return url.origin;
}

function expiryMinutes(name: string, defaultMinutes: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return defaultMinutes;
  const minutes = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(minutes) || minutes < 1 || minutes > maximum) throw new Error(`${name} must be a bounded positive integer`);
  return minutes;
}
export function identityConfig() {
  validateNotificationEncryption(); identityAppOrigin(); trustedAppUrl();
  return { verificationMinutes: expiryMinutes("IDENTITY_VERIFICATION_TTL_MINUTES", 1440, 1440), resetMinutes: expiryMinutes("IDENTITY_RESET_TTL_MINUTES", 30, 120) };
}
