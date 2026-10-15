import type { NotificationCategory, NotificationChannel } from "@prisma/client";
import { safeInternalDestination } from "./config";

type Definition = { category: NotificationCategory; title: string; body: string; href: string; secret?: boolean };
const security = (title: string, body: string, href = "/settings", secret = false): Definition => ({ category: "SECURITY", title, body, href, secret });
const billing = (title: string, body: string): Definition => ({ category: "BILLING", title, body, href: "/billing" });
const operational = (title: string, body: string, href: string): Definition => ({ category: "OPERATIONAL", title, body, href });
export const EVENT_DEFINITIONS: Record<string, Definition> = {
  "identity.verification_requested": security("Verify your email to finish setting up BizOpt", "Thanks for creating your account. Confirm your email to finish setup.", "/verify-email", true),
  "identity.verified": security("Welcome to BizOpt — let’s create your first campaign", "Your email is verified. Visit Home to see your current access and start creating.", "/home"),
  "identity.password_reset_requested": security("Reset your BizOpt password", "Confirm your password reset using the secure link. Your existing password remains unchanged until you confirm.", "/forgot-password", true),
  "identity.password_changed": security("Your BizOpt password was changed", "Your password changed and existing sessions were revoked. If this wasn’t you, reset your password and contact support.", "/forgot-password"),
  "identity.email_change_requested": security("Verify your new BizOpt email address", "Confirm this new email address before it replaces your current address.", "/settings", true),
  "identity.email_changed": security("Your BizOpt email address was changed", "Your account email address changed. If this wasn’t you, contact support immediately.", "/help"),
  "account.deletion_requested": security("Your BizOpt deletion request was received", "Your deletion request is awaiting review. This notice does not confirm account deletion.", "/help"),
  "account.export_requested": security("Your BizOpt data export was requested", "Your account data export was requested. Check Settings for its preparation status.", "/settings"),
  "account.export_ready": security("Your BizOpt data export is ready", "Your data export is ready. Sign in to your account to download it before its recorded expiry.", "/settings"),
  "account.deletion_completed": security("Your BizOpt account deletion completed", "Your account deletion was completed according to the reviewed deletion request.", "/help"),
  "device.rebound": security("Your active BizOpt device changed", "A device rebind completed. Review your devices. If this wasn’t you, reset your password and contact support.", "/devices"),
  "device.rebind_requested": security("A BizOpt device rebind was requested", "A device rebind was requested for your account. Review your devices and contact support if you did not request it.", "/devices"),
  "billing.introductory_active": billing("Your 7-day BizOpt introductory access is active", "Your introductory payment was confirmed. Review your actual access dates and next recurring payment below."),
  "billing.introductory_ending": billing("Your BizOpt introductory access ends soon", "Your introductory access is ending. Review the upcoming recurring charge and manage or cancel your subscription before renewal."),
  "billing.monthly_active": billing("Your BizOpt monthly subscription is active", "Your first recurring payment was confirmed. Review your service period and next renewal in Billing."),
  "billing.renewed": billing("Your BizOpt subscription has renewed", "Your recurring payment was confirmed. Review your paid service period in Billing."),
  "billing.payment_failed": billing("Action needed: update your BizOpt payment method", "Your payment could not be completed. Review your current access and update your payment method in Billing."),
  "billing.authentication_required": billing("Complete payment authentication for BizOpt", "Your payment needs authentication. Open Billing to complete the secure payment recovery flow."),
  "billing.payment_recovered": billing("Your BizOpt payment was recovered", "Your payment recovery was confirmed. Billing shows your reconciled access and service period."),
  "billing.cancellation_scheduled": billing("Your BizOpt cancellation is scheduled", "Your subscription is scheduled to end. Billing shows your remaining access and cancellation details."),
  "billing.resumed": billing("Your BizOpt subscription will continue", "Your scheduled cancellation was removed. Recurring billing will continue according to your current plan."),
  "billing.ended": billing("Your BizOpt subscription access has ended", "Your subscription access has ended. Review Billing for your current options."),
  "billing.refund_pending": billing("Your BizOpt refund is pending", "Your refund is being processed. This notice does not confirm a completed refund or subscription cancellation."),
  "billing.refunded": billing("Your BizOpt refund was confirmed", "Your payment provider confirmed the refund. A refund does not automatically cancel a subscription."),
  "billing.refund_failed": billing("Your BizOpt refund needs review", "The refund could not be completed. Contact support to review the next step."),
  "billing.dispute": { category: "BILLING", title: "A BizOpt payment dispute needs review", body: "A verified payment dispute was recorded. Review internal support and the approved risk policy before taking action.", href: "/support-console" },
  "publishing.failed": operational("Your scheduled publication failed", "A scheduled publication failed. Open the campaign to review the issue and retry where supported.", "/calendar"),
  "publishing.missed": operational("A scheduled publication was missed", "A scheduled publication did not complete at its expected time. Review its current status before retrying.", "/calendar"),
  "publishing.exhausted": operational("Repeated publishing attempts failed", "Repeated publishing attempts failed. Review the publication and connection before taking further action.", "/calendar"),
  "connection.reconnect_required": operational("Reconnect your social account", "A social connection needs attention before publishing can continue.", "/integrations"),
  "generation.ready": operational("Your generation is ready", "A long-running generation completed. Open AI Studio to review the result.", "/ai-studio"),
  "generation.failed": operational("Your generation could not complete", "A generation failed after its final retry. Open AI Studio to review the result and available next steps.", "/ai-studio"),
  "usage.limit_reached": operational("Your BizOpt usage limit was reached", "A recorded usage limit was reached. Review the current plan limits in Billing.", "/billing"),
};

export function getEventDefinition(eventType: string): Definition {
  const definition = EVENT_DEFINITIONS[eventType];
  if (!definition) throw new Error("Unsupported notification event.");
  return definition;
}
export function notificationMetadata(eventType: string, _data?: unknown): { title: string; body: string; href: string } {
  void _data;
  const { title, body, href } = getEventDefinition(eventType);
  return { title, body, href };
}
export function channelsForEvent(eventType: string, preferences: { category: string; channel: string; enabled: boolean }[]): NotificationChannel[] {
  const { category } = getEventDefinition(eventType);
  if (category === "MARKETING") return [];
  return (["EMAIL", "IN_APP"] as const).filter(channel => category === "SECURITY" || category === "BILLING" || preferences.some(p => p.category === category && p.channel === channel && p.enabled));
}

/** Public event data is deliberately limited to reviewed scalar facts. */
export function sanitizeEventData(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Notification event data must be an object.");
  const allow = ["plan", "amountMinor", "currency", "introductoryAmountMinor", "recurringAmountMinor", "periodStart", "periodEnd", "nextBillingAt", "invoiceUrl", "invoiceId", "refundReference", "graceUntil", "expiresAt", "occurredAt", "requestedAt", "changedAt", "accessUntil", "deviceLabel", "failureCode", "errorCode", "reasonCode", "platform", "usageLimit", "usageCount", "introductoryDurationDays", "paymentReference", "callbackUrl"];
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/token|password|secret|authorization|card|bank/i.test(key)) throw new Error("Sensitive data must use the encrypted notification envelope.");
    if (!allow.includes(key)) continue;
    if (key === "callbackUrl") { const destination = safeInternalDestination(entry, ""); if (destination) result[key] = destination; continue; }
    if (entry === null || typeof entry === "boolean" || (typeof entry === "number" && Number.isFinite(entry)) || (typeof entry === "string" && entry.length <= 2048 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(entry))) result[key] = entry;
  }
  return result;
}
