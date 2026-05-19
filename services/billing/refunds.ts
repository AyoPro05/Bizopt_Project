import { db } from "@/lib/db";
import { BILLING } from "@/lib/constants";
import { isWithinRefundWindow } from "@/lib/dates";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function isRefundEligible(orgId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  const subscription = await db.subscription.findUnique({ where: { orgId } });
  if (!subscription) {
    return { eligible: false, reason: "No subscription found" };
  }

  const recentPayment = await db.payment.findFirst({
    where: { orgId, status: "succeeded" },
    orderBy: { createdAt: "desc" },
  });

  if (!recentPayment) {
    return { eligible: false, reason: "No successful payment on record" };
  }

  if (!isWithinRefundWindow(recentPayment.createdAt, BILLING.refundWindowDays)) {
    return {
      eligible: false,
      reason: `Refunds available within ${BILLING.refundWindowDays} days of purchase only`,
    };
  }

  const campaignCount = await db.campaign.count({
    where: { orgId, status: { not: "draft" } },
  });
  if (campaignCount > 5) {
    return { eligible: false, reason: "High usage — contact support for partial refunds" };
  }

  return { eligible: true };
}

export async function createRefund(
  paymentId: string,
  reason?: string
): Promise<{ refund: Stripe.Refund; record: Awaited<ReturnType<typeof db.refund.create>> }> {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { refunds: true },
  });

  const existingPending = payment.refunds.find((r) =>
    ["refund_pending", "pending"].includes(r.status)
  );
  if (existingPending) {
    throw new Error("A refund is already in progress");
  }

  if (!payment.stripePaymentIntentId?.startsWith("pi_")) {
    throw new Error("Cannot refund this payment type");
  }

  const stripeRefund = await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    reason: "requested_by_customer",
  });

  const record = await db.refund.create({
    data: {
      paymentId: payment.id,
      stripeRefundId: stripeRefund.id,
      amountCents: stripeRefund.amount,
      currency: stripeRefund.currency,
      status: "refund_pending",
      reason,
    },
  });

  await db.entitlement.updateMany({
    where: { orgId: payment.orgId },
    data: { userFacingState: "refund_pending" },
  });

  return { refund: stripeRefund, record };
}

export async function syncRefundFromStripe(charge: Stripe.Charge) {
  const refundData = charge.refunds?.data[0];
  if (!refundData) return null;

  const payment = await db.payment.findFirst({
    where: { stripePaymentIntentId: charge.payment_intent as string },
  });
  if (!payment) return null;

  return db.refund.upsert({
    where: { stripeRefundId: refundData.id },
    create: {
      paymentId: payment.id,
      stripeRefundId: refundData.id,
      amountCents: refundData.amount,
      currency: refundData.currency,
      status: refundData.status === "succeeded" ? "refund_approved" : "refund_pending",
    },
    update: {
      status: refundData.status === "succeeded" ? "refund_approved" : "refund_failed",
    },
  });
}
