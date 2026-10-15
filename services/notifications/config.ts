export class NotificationConfigurationError extends Error {
  constructor() { super("Notification service configuration is incomplete."); }
}

export function trustedAppUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) throw new NotificationConfigurationError();
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new NotificationConfigurationError();
  return url.origin;
}

export function safeAppLink(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\u0000-\u0020]/.test(path)) throw new NotificationConfigurationError();
  const origin = trustedAppUrl();
  const url = new URL(path, origin);
  if (url.origin !== origin) throw new NotificationConfigurationError();
  return url.href;
}

export function safeInternalDestination(value: unknown, fallback = "/home"): string {
  if (typeof value !== "string" || value.length > 1000 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, trustedAppUrl());
    if (url.origin !== trustedAppUrl() || Array.from(url.searchParams.keys()).some(key => /token|password|secret|authorization/i.test(key))) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}

export function validateNotificationEncryption(): Buffer {
  const raw = process.env.NOTIFICATION_PAYLOAD_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw) throw new NotificationConfigurationError();
  return key;
}

export function notificationConfig() {
  const from = process.env.EMAIL_FROM || "";
  const replyTo = process.env.EMAIL_REPLY_TO || "";
  const support = process.env.SUPPORT_URL || "";
  const mailbox = /^(?:[^<>\r\n]+ <)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/;
  if (!mailbox.test(from) || !mailbox.test(replyTo) || /[\r\n]/.test(from + replyTo)) throw new NotificationConfigurationError();
  const supportUrl = new URL(support);
  if (!/^https?:$/.test(supportUrl.protocol) || supportUrl.username || supportUrl.password || (process.env.NODE_ENV === "production" && supportUrl.protocol !== "https:")) throw new NotificationConfigurationError();
  const provider = process.env.EMAIL_PROVIDER;
  if (provider !== "fake" && provider !== "resend") throw new NotificationConfigurationError();
  if (provider === "fake" && process.env.NODE_ENV === "production") throw new NotificationConfigurationError();
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY || process.env.RESEND_API_KEY;
  if (provider === "resend" && (!apiKey || !process.env.EMAIL_WEBHOOK_SECRET)) throw new NotificationConfigurationError();
  trustedAppUrl();
  validateNotificationEncryption();
  return { from, replyTo, supportUrl: supportUrl.href, provider, apiKey } as const;
}

/** Only provider-owned invoice URLs may leave the application origin. */
export function safeInvoiceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && ["invoice.stripe.com", "pay.stripe.com", "billing.stripe.com", "checkout.stripe.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
