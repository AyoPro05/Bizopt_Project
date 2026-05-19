import { addDays } from "date-fns";
import { stripe, getMonthlyPriceId, getTrialFeePriceId } from "@/lib/stripe";
import { BILLING } from "@/lib/constants";
import { appUrl } from "@/lib/helpers";
import { db } from "@/lib/db";

export async function createCheckoutSession(
  orgId: string,
  userId: string,
  email: string,
  options?: { successUrl?: string; cancelUrl?: string }
) {
  let subscription = await db.subscription.findUnique({ where: { orgId } });
  let customerId = subscription?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { orgId, userId },
    });
    customerId = customer.id;
    await db.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        stripeCustomerId: customerId,
        planId: BILLING.planId,
        status: "pending_payment",
        currency: BILLING.currency,
        amountCents: BILLING.amountCents,
        trialPriceCents: BILLING.trialPriceCents,
        trialDays: BILLING.trialDays,
        requiresPaymentMethod: true,
      },
      update: { stripeCustomerId: customerId },
    });
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: getMonthlyPriceId(), quantity: 1 },
  ];

  const trialFeePriceId = getTrialFeePriceId();
  if (trialFeePriceId) {
    lineItems.unshift({ price: trialFeePriceId, quantity: 1 });
  }

  const trialEnd = addDays(new Date(), BILLING.trialDays);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    payment_method_collection: "always",
    success_url: options?.successUrl ?? appUrl("/billing?checkout=success"),
    cancel_url: options?.cancelUrl ?? appUrl("/pricing?checkout=canceled"),
    subscription_data: {
      trial_period_days: BILLING.trialDays,
      metadata: { orgId, userId },
      trial_settings: {
        end_behavior: { missing_payment_method: "cancel" },
      },
    },
    metadata: { orgId, userId },
    payment_method_types: ["card"],
    billing_address_collection: "auto",
  });

  await db.subscription.update({
    where: { orgId },
    data: {
      trialStartAt: new Date(),
      trialEndAt: trialEnd,
      requiresPaymentMethod: true,
      status: "pending_payment",
    },
  });

  await db.entitlement.upsert({
    where: { orgId },
    create: {
      orgId,
      active: false,
      deviceLimit: 1,
      userFacingState: "pending_payment",
    },
    update: { userFacingState: "pending_payment" },
  });

  return session;
}

export async function createPortalSession(orgId: string) {
  const subscription = await db.subscription.findUnique({ where: { orgId } });
  if (!subscription?.stripeCustomerId) {
    throw new Error("No billing account found");
  }
  return stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: appUrl("/billing"),
  });
}
