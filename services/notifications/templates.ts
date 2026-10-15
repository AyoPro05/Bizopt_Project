import { notificationConfig, safeAppLink, safeInvoiceUrl, safeInternalDestination } from "./config";
import { createUnsubscribeProof } from "./crypto";
import { getEventDefinition } from "./policy";

export interface RenderedEmail { subject: string; html: string; text: string }
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function date(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().replace("T", " ").replace(".000Z", " UTC") : null;
}
function money(amount: unknown, currency: unknown): string | null {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0 || typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency)) return null;
  try { const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }); return formatter.format(amount / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2)); } catch { return null; }
}
export function renderEmail(eventType: string, input: unknown, options: { secret?: Record<string, string>; secretExpiresAt?: Date | null; preview?: boolean; userId?: string } = {}): RenderedEmail {
  const config = notificationConfig();
  const definition = getEventDefinition(eventType);
  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const paragraphs = [definition.body];
  const links: { label: string; href: string }[] = [];
  if (definition.secret) {
    if (!options.preview && (!options.secret?.id || !options.secret?.token || !options.secretExpiresAt)) throw new Error("Proof email requires an expiring secret.");
    const path = eventType === "identity.password_reset_requested" ? "/reset-password" : "/verify-email";
    let href = safeAppLink(path);
    const callback = safeInternalDestination(data.callbackUrl, "");
    if (callback) href += `?${new URLSearchParams({ callbackUrl: callback }).toString()}`;
    if (!options.preview) {
      const fragment = new URLSearchParams({ id: options.secret!.id, token: options.secret!.token });
      if (eventType === "identity.email_change_requested") fragment.set("purpose", "email-change");
      href += `#${fragment.toString()}`;
    }
    links.push({ label: eventType === "identity.password_reset_requested" ? "Reset password" : "Verify email", href });
    paragraphs.push(options.preview ? "Preview: the secure link and expiry are inserted only for a real requested proof." : `This link expires at ${options.secretExpiresAt!.toISOString()}. Opening the page does not confirm the action; use the confirmation form.`);
    paragraphs.push(eventType === "identity.verification_requested" ? "If you did not create this account, you can ignore this email." : "If you did not request this action, ignore this email and contact support if needed.");
  } else links.push({ label: definition.category === "BILLING" ? "Manage or cancel subscription" : "Open BizOpt", href: safeAppLink(definition.href) });
  if (eventType === "identity.verified") {
    paragraphs.push("Email verification does not activate a paid subscription. Your current plan and recorded usage limits are shown in Billing; any limited free preview remains separate from paid access.");
    links.push({ label: "Create from Idea", href: safeAppLink("/ai-studio") }, { label: "Connect social accounts", href: safeAppLink("/integrations") }, { label: "Business profile", href: safeAppLink("/settings") });
  }
  if (definition.category === "BILLING") {
    if (typeof data.plan === "string") paragraphs.push(`Plan: ${data.plan}`);
    const amount = money(data.amountMinor ?? data.introductoryAmountMinor, data.currency);
    if (amount) paragraphs.push(`Amount: ${amount}.`);
    for (const [key, label] of [["periodStart", "Service period starts"], ["periodEnd", "Service period ends"], ["nextBillingAt", "Next expected billing date"], ["accessUntil", "Access ends"], ["graceUntil", "Recorded grace period ends"]]) {
      const formatted = date(data[key]);
      if (formatted) paragraphs.push(`${label}: ${formatted}.`);
    }
    const recurring = money(data.recurringAmountMinor, data.currency);
    if (recurring && !["billing.ended", "billing.cancellation_scheduled", "billing.refund_pending", "billing.refunded", "billing.refund_failed", "billing.dispute"].includes(eventType)) paragraphs.push(`Recurring price: ${recurring}/month until canceled. Applicable tax treatment and the current total are shown in Billing and on the invoice.`);
    const invoice = safeInvoiceUrl(data.invoiceUrl);
    if (invoice) links.push({ label: "View hosted invoice", href: invoice });
    if (typeof data.paymentReference === "string") paragraphs.push(`Payment reference: ${data.paymentReference}`);
    paragraphs.push("Review the features and actual usage limits for your plan in Billing. Provider receipts are separate from this product status notice.");
  }
  const occurred = date(data.occurredAt ?? data.changedAt ?? data.requestedAt);
  if (occurred) paragraphs.push(`Recorded at: ${occurred}.`);
  if (typeof data.deviceLabel === "string") paragraphs.push(`Device: ${data.deviceLabel}`);
  links.push({ label: "Contact support", href: config.supportUrl });
  if (["OPERATIONAL", "DIGEST"].includes(definition.category)) {
    const href = safeAppLink("/notifications/unsubscribe") + (!options.preview && options.userId ? `#token=${createUnsubscribeProof(options.userId, definition.category)}` : "");
    links.push({ label: "Change optional email preferences", href });
  }
  const text = `${definition.title}\n\n${paragraphs.join("\n\n")}\n\n${links.map(link => `${link.label}: ${link.href}`).join("\n\n")}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(definition.title)}</title></head><body style="margin:0;background:#f6f7f9;color:#172033;font-family:Arial,sans-serif"><main style="max-width:600px;margin:24px auto;padding:32px;background:white;border-radius:8px"><p style="font-size:16px;font-weight:bold">BizOpt</p><h1 style="font-size:24px;line-height:1.3">${escapeHtml(definition.title)}</h1>${paragraphs.map(p => `<p style="font-size:16px;line-height:1.6">${escapeHtml(p)}</p>`).join("")}${links.map(link => `<p><a href="${escapeHtml(link.href)}" style="color:#284ec5">${escapeHtml(link.label)}</a></p>`).join("")}</main></body></html>`;
  return { subject: definition.title, html, text };
}
