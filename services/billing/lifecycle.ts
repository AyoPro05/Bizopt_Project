import type Stripe from "stripe";
import { getPlanDefinition, assertPlanPrice } from "./plans";
export type InvoicePurpose = "INTRODUCTORY" | "RECURRING" | "ADJUSTMENT" | "OTHER";
export type ConsentEvidence = { id: string; checkoutIntentId: string; planKey: string; introductoryAmountMinor: number; introductoryDurationDays: number; recurringAmountMinor: number; currency: string };
export const providerId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
export function classifyInvoice(invoice: Stripe.Invoice, sub: Stripe.Subscription, consent: ConsentEvidence | null, ids = { base: process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_ID, team: process.env.STRIPE_TEAM_PRICE_ID, introductory: process.env.STRIPE_INTRODUCTORY_PRICE_ID || process.env.STRIPE_TRIAL_FEE_PRICE_ID }): InvoicePurpose {
  if (providerId(invoice.subscription) !== sub.id || providerId(invoice.customer) !== providerId(sub.customer) || invoice.lines.has_more) return "OTHER";
  if (invoice.billing_reason === "subscription_create" && consent && sub.metadata?.checkoutIntentId === consent.checkoutIntentId && sub.metadata?.consentId === consent.id && invoice.currency === consent.currency) {
    const plan = getPlanDefinition(consent.planKey === "team" ? "team" : "base");
    const fee = invoice.lines.data.find(line => line.price?.id === ids.introductory);
    if (consent.introductoryAmountMinor === 99 && consent.introductoryDurationDays === 7 && consent.recurringAmountMinor === plan.amountCents && consent.currency === "usd" && fee?.quantity === 1 && fee.amount - (fee.discount_amounts ?? []).reduce((total, discount) => total + discount.amount, 0) === 99 && fee.price?.unit_amount === 99 && fee.price.type === "one_time" && fee.price.currency === "usd" && !fee.proration) return "INTRODUCTORY";
  }
  const recurring = invoice.lines.data.some(line => {
    if (!line.price || line.quantity !== 1 || providerId(line.subscription) !== sub.id || line.amount - (line.discount_amounts ?? []).reduce((total, discount) => total + discount.amount, 0) <= 0) return false;
    const key = line.price.id === ids.base ? "base" : line.price.id === ids.team ? "team" : null;
    if (!key) return false;
    try { assertPlanPrice(line.price, getPlanDefinition(key)); return true; } catch { return false; }
  });
  if (recurring && invoice.billing_reason === "subscription_cycle" && !invoice.lines.data.some(line => line.proration)) return "RECURRING";
  return recurring && invoice.billing_reason === "subscription_update" ? "ADJUSTMENT" : "OTHER";
}
export function invoiceIsPaid(invoice: Stripe.Invoice): boolean { return invoice.paid && invoice.status === "paid" && invoice.amount_paid > 0 && invoice.amount_due > 0; }
export function invoicePeriod(invoice: Stripe.Invoice, purpose: InvoicePurpose, sub: Stripe.Subscription): { start: Date; end: Date } | null {
  if (purpose === "INTRODUCTORY") return sub.trial_start && sub.trial_end ? { start: new Date(sub.trial_start * 1000), end: new Date(sub.trial_end * 1000) } : null;
  const lines = invoice.lines.data.filter(line => line.type === "subscription" && !line.proration && providerId(line.subscription) === sub.id);
  if (!lines.length) return null;
  return { start: new Date(Math.min(...lines.map(line => line.period.start)) * 1000), end: new Date(Math.max(...lines.map(line => line.period.end)) * 1000) };
}
export function hasPaidAccess(local: { status: string; paidThrough?: Date | null; introductoryPaidAt?: Date | null; graceUntil?: Date | null }, now = Date.now()): boolean {
  if (!["trialing", "active", "past_due"].includes(local.status)) return false;
  if (local.status === "trialing" && !local.introductoryPaidAt) return false;
  return Math.max(local.paidThrough?.getTime() ?? 0, local.status === "past_due" ? local.graceUntil?.getTime() ?? 0 : 0) > now;
}
export function introductoryReminderDue(local: { status: string; introductoryPaidAt?: Date | null; trialEndAt?: Date | null; cancelAtPeriodEnd: boolean; firstRecurringInvoiceId?: string | null }, now = Date.now()): boolean {
  const remaining = (local.trialEndAt?.getTime() ?? 0) - now;
  return local.status === "trialing" && !!local.introductoryPaidAt && !local.cancelAtPeriodEnd && !local.firstRecurringInvoiceId && remaining > 0 && remaining <= 3 * 86400_000;
}
export function refundStatus(status: string | null): string {
  return status === "succeeded" ? "refunded" : status === "failed" || status === "canceled" ? "refund_failed" : "refund_pending";
}
