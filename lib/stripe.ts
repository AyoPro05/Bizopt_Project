import Stripe from "stripe";
import { BILLING } from "./constants";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return Reflect.get(getStripe(), prop);
  },
});

export function getPlanPriceId(plan: "base" | "team"): string {
  if (plan === "base") return getMonthlyPriceId();
  const priceId = process.env.STRIPE_TEAM_PRICE_ID;
  if (!priceId) throw new Error("Team checkout is unavailable: STRIPE_TEAM_PRICE_ID is not configured");
  return priceId;
}

export function getMonthlyPriceId(): string {
  const priceId = process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_MONTHLY_PRICE_ID is not configured (legacy STRIPE_PRICE_ID is also supported)");
  }
  return priceId;
}

/** Mandatory one-time paid introductory fee; never fall back to a free offer. */
export function getTrialFeePriceId(): string {
  const id = process.env.STRIPE_INTRODUCTORY_PRICE_ID || process.env.STRIPE_TRIAL_FEE_PRICE_ID;
  if (!id) throw new Error("STRIPE_INTRODUCTORY_PRICE_ID is required for the paid introductory offer");
  return id;
}

/** @deprecated use getMonthlyPriceId */
export function getPriceId(): string {
  return getMonthlyPriceId();
}

export function formatMoney(amountCents: number, currency: string = BILLING.currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "payment_intent.succeeded",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
] as const;
