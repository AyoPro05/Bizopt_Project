import { db } from "@/lib/db";
import { BILLING } from "@/lib/constants";
import type Stripe from "stripe";

export async function upsertSubscriptionFromStripe(
  orgId: string,
  sub: Stripe.Subscription
) {
  const item = sub.items.data[0];
  const amountCents = item?.price?.unit_amount ?? BILLING.amountCents;
  const currency = item?.price?.currency ?? BILLING.currency;

  const trialStartAt = sub.trial_start
    ? new Date(sub.trial_start * 1000)
    : null;
  const trialEndAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

  let paymentMethodId: string | null = null;
  if (sub.default_payment_method) {
    paymentMethodId =
      typeof sub.default_payment_method === "string"
        ? sub.default_payment_method
        : sub.default_payment_method.id;
  }

  return db.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      stripePaymentMethodId: paymentMethodId,
      planId: BILLING.planId,
      status: sub.status,
      currency,
      amountCents,
      trialPriceCents: BILLING.trialPriceCents,
      trialDays: BILLING.trialDays,
      trialStartAt,
      trialEndAt,
      requiresPaymentMethod: true,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialConvertedAt:
        sub.status === "active" && trialEndAt && trialEndAt < new Date()
          ? new Date()
          : null,
    },
    update: {
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripeSubscriptionId: sub.id,
      stripePaymentMethodId: paymentMethodId,
      status: sub.status,
      currency,
      amountCents,
      trialStartAt,
      trialEndAt,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      trialConvertedAt:
        sub.status === "active" && trialEndAt && trialEndAt < new Date()
          ? new Date()
          : undefined,
    },
  });
}
