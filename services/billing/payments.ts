import { db } from "@/lib/db";
import type Stripe from "stripe";

export async function recordPaymentFromInvoice(
  orgId: string,
  invoice: Stripe.Invoice,
  status: string
) {
  const subscription = await db.subscription.findUnique({ where: { orgId } });
  const amountCents = invoice.amount_paid ?? invoice.amount_due ?? 0;

  return db.payment.upsert({
    where: {
      stripePaymentIntentId:
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : invoice.payment_intent?.id ?? `inv_${invoice.id}`,
    },
    create: {
      orgId,
      subscriptionId: subscription?.id,
      stripePaymentIntentId:
        typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : invoice.payment_intent?.id ?? `inv_${invoice.id}`,
      stripeInvoiceId: invoice.id,
      amountCents,
      currency: invoice.currency,
      status,
    },
    update: {
      status,
      amountCents,
    },
  });
}

export async function recordPaymentIntent(
  orgId: string,
  pi: Stripe.PaymentIntent,
  subscriptionId?: string
) {
  return db.payment.upsert({
    where: { stripePaymentIntentId: pi.id },
    create: {
      orgId,
      subscriptionId,
      stripePaymentIntentId: pi.id,
      amountCents: pi.amount,
      currency: pi.currency,
      status: pi.status,
      failureCode: pi.last_payment_error?.code ?? null,
      failureMessage: pi.last_payment_error?.message ?? null,
    },
    update: {
      status: pi.status,
      failureCode: pi.last_payment_error?.code ?? null,
      failureMessage: pi.last_payment_error?.message ?? null,
    },
  });
}
