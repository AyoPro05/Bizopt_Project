import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { emitBillingEvent } from "./events";
import { providerId, refundStatus } from "./lifecycle";

/** These are operator-reviewed policy inputs, deliberately absent by default. */
function reviewedPolicy() {
  const version = process.env.BILLING_AUTO_REFUND_POLICY_VERSION;
  const days = Number(process.env.BILLING_AUTO_REFUND_WINDOW_DAYS);
  if (!version || !Number.isInteger(days) || days < 1 || days > 365) return null;
  return { version, days };
}
export async function isRefundEligible(orgId: string): Promise<{ eligible: boolean; reviewAvailable: boolean; reason?: string }> {
  const payment = await db.payment.findFirst({ where: { orgId, status: "succeeded", amountCents: { gt: 0 } }, orderBy: { createdAt: "desc" } });
  if (!payment) return { eligible: false, reviewAvailable: false, reason: "No successful payment on record" };
  const policy = reviewedPolicy();
  if (!policy) return { eligible: false, reviewAvailable: true, reason: "Automatic refunds are unavailable until a refund policy is reviewed. You can request support review; applicable consumer rights remain available." };
  const within = Date.now() - payment.createdAt.getTime() <= policy.days * 86400_000;
  return { eligible: within, reviewAvailable: true, ...(!within ? { reason: "This payment requires support review under the configured policy. Applicable consumer rights remain available." } : {}) };
}
export async function createRefund(paymentId: string, reason?: string) {
  const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { refunds: true } });
  if (payment.status !== "succeeded" || payment.amountCents <= 0) throw new Error("Only a settled payment can be reviewed for a refund");
  const policy = reviewedPolicy();
  const automatic = !!policy && Date.now() - payment.createdAt.getTime() <= policy.days * 86400_000;
  const record = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${payment.orgId}))`;
    const existing = await tx.refund.findFirst({ where: { paymentId, status: { in: ["review_requested", "approved", "refund_pending", "refunded", "refund_approved"] } }, orderBy: { createdAt: "desc" } });
    if (existing) return existing;
    const request = await tx.refund.create({ data: { paymentId, amountCents: payment.amountCents, currency: payment.currency, status: automatic ? "approved" : "review_requested", reason } });
    await tx.auditLog.create({ data: { orgId: payment.orgId, action: automatic ? "billing.refund_policy_approved" : "billing.refund_review_requested", entity: "refund", entityId: request.id, metadata: { ...(automatic ? { policyVersion: policy!.version } : {}), paymentId } } });
    return request;
  });
  if (record.status !== "approved") return { refund: null, record };
  if (!payment.stripePaymentIntentId?.startsWith("pi_")) throw new Error("This payment requires manual processor review");
  if (Date.now() - record.createdAt.getTime() > 23 * 3600_000) throw new Error("Provider refund result needs review before retrying");
  const refund = await stripe.refunds.create({ payment_intent: payment.stripePaymentIntentId, amount: record.amountCents, reason: "requested_by_customer" }, { idempotencyKey: `refund:${record.id}` });
  await db.refund.update({ where: { id: record.id }, data: { stripeRefundId: refund.id } });
  const confirmed = await syncRefund(refund.id);
  return { refund, record: confirmed ?? record };
}
export async function syncRefund(refundId: string) {
  const preliminary = await stripe.refunds.retrieve(refundId);
  const intentId = providerId(preliminary.payment_intent);
  if (!intentId) return null;
  const payment = await db.payment.findFirst({ where: { stripePaymentIntentId: intentId } });
  if (!payment) return null;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${payment.orgId}))`;
    // Re-fetch after locking, so pending snapshots cannot overwrite success.
    const refund = await stripe.refunds.retrieve(refundId);
    if (providerId(refund.payment_intent) !== intentId) throw new Error("Refund payment ownership mismatch");
    const status = refundStatus(refund.status);
    const record = await tx.refund.upsert({ where: { stripeRefundId: refund.id }, create: { paymentId: payment.id, stripeRefundId: refund.id, amountCents: refund.amount, currency: refund.currency, status }, update: { status, amountCents: refund.amount, currency: refund.currency } });
    const subscription = await tx.subscription.findUnique({ where: { orgId: payment.orgId } });
    if (subscription?.stripeSubscriptionId) await emitBillingEvent(tx, payment.orgId, subscription.stripeSubscriptionId, `billing.${status}`, `${status}:${refund.id}`, { amountMinor: refund.amount, currency: refund.currency, paymentReference: payment.id, refundReference: record.id });
    // A refund never cancels a subscription or changes entitlement without an approved access policy.
    return record;
  });
}
export async function syncRefundFromStripe(charge: Stripe.Charge) {
  let last = null;
  // List the complete current refund collection, never just the first stale charge snapshot entry.
  for await (const refund of stripe.refunds.list({ charge: charge.id, limit: 100 })) last = await syncRefund(refund.id);
  return last;
}
