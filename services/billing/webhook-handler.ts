import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import { addDays } from "date-fns";
import { BILLING } from "@/lib/constants";
import { getPlanDefinition } from "./plans";
import { revokeEntitlement } from "./entitlements";
import { upsertSubscriptionFromStripe } from "./subscriptions";
import { recordPaymentFromInvoice, recordPaymentIntent } from "./payments";
import { syncRefundFromStripe } from "./refunds";
import { BillingCapacityConflict, reconcilePlanSubscription } from "./plan-changes";

async function resolveOrgIdFromStripe(customerId: string, metadataOrgId?: string | null) {
  if (!customerId) return null;
  if (metadataOrgId) {
    const local = await db.subscription.findUnique({ where: { orgId: metadataOrgId } });
    if (local?.stripeCustomerId === customerId) return metadataOrgId;
  }
  return (await db.subscription.findFirst({ where: { stripeCustomerId: customerId } }))?.orgId ?? null;
}

export async function syncProviderSubscription(orgId: string, subscriptionId: string) {
  try { return await db.$transaction(async tx => {
    // Read provider state after a per-workspace lock. Out-of-order events cannot replay stale entitlements.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;
    const local = await tx.subscription.findUnique({ where: { orgId } });
    if (!local || (local.stripeSubscriptionId && local.stripeSubscriptionId !== subscriptionId)) return;
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice", "default_payment_method"] });
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    if (local.stripeCustomerId !== customerId) throw new Error("Provider subscription ownership mismatch");
    const record = await upsertSubscriptionFromStripe(orgId, sub, tx);
    await reconcilePlanSubscription(orgId, sub, tx);
    if (sub.status === "past_due") {
      // Do not extend grace each time an old/duplicate invoice event is retried.
      const graceUntil = local.graceUntil ?? addDays(new Date(), BILLING.gracePeriodDays);
      await tx.subscription.update({ where: { orgId }, data: { graceUntil } });
      const state = { active: graceUntil.getTime() > Date.now(), userFacingState: "grace_period", accessUntil: graceUntil };
      await tx.entitlement.upsert({ where: { orgId }, create: { orgId, subscriptionId: record.id, ...state }, update: state });
    } else if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(sub.status)) {
      const state = { active: false, userFacingState: "canceled", accessUntil: new Date() };
      await tx.entitlement.upsert({ where: { orgId }, create: { orgId, subscriptionId: record.id, ...state }, update: state });
    }
    return sub;
  }, { maxWait: 10000, timeout: 30000, isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof BillingCapacityConflict) {
      await db.$transaction(async tx => {
        const providerPlan = getPlanDefinition(error.providerPlan);
        await tx.subscription.update({ where: { orgId }, data: { selectedPlan: providerPlan.key, amountCents: providerPlan.amountCents, currency: providerPlan.currency } });
        await tx.entitlement.updateMany({ where: { orgId }, data: { active: false, planKey: providerPlan.key, seatLimit: providerPlan.capacity, userFacingState: "webhook_syncing" } });
        await tx.billingPlanChange.updateMany({ where: { orgId, status: { in: ["processing", "pending_payment", "scheduled"] } }, data: { status: "reconciliation_required", error: "Provider plan and member capacity disagree. Billing operations must review this workspace." } });
        await tx.auditLog.create({ data: { orgId, action: "billing.owner_attention_required", entity: "subscription", entityId: subscriptionId, metadata: { providerPlan: error.providerPlan } } });
      });
    }
    throw error;
  }
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type.startsWith("customer.subscription.")) {
    const snapshot = event.data.object as Stripe.Subscription;
    const customerId = typeof snapshot.customer === "string" ? snapshot.customer : snapshot.customer.id;
    const orgId = await resolveOrgIdFromStripe(customerId, snapshot.metadata?.orgId);
    if (orgId) await syncProviderSubscription(orgId, snapshot.id);
    return;
  }
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const orgId = customerId ? await resolveOrgIdFromStripe(customerId, session.metadata?.orgId) : null;
      if (orgId && subscriptionId) await syncProviderSubscription(orgId, subscriptionId);
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.payment_action_required": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? "";
      const orgId = await resolveOrgIdFromStripe(customerId, invoice.metadata?.orgId);
      if (!orgId) return;
      if (event.type !== "invoice.payment_action_required") await recordPaymentFromInvoice(orgId, invoice, event.type === "invoice.payment_succeeded" ? "succeeded" : "failed");
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (subscriptionId) await syncProviderSubscription(orgId, subscriptionId);
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const customerId = typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? "";
      const orgId = await resolveOrgIdFromStripe(customerId, intent.metadata?.orgId);
      if (!orgId) return;
      const local = await db.subscription.findUnique({ where: { orgId } });
      await recordPaymentIntent(orgId, intent, local?.id);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      await syncRefundFromStripe(charge);
      const payment = await db.payment.findFirst({ where: { stripePaymentIntentId: typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id } });
      if (payment) await revokeEntitlement(payment.orgId, "refund_approved");
      break;
    }
    default: logger.debug("unhandled_stripe_event", { type: event.type });
  }
}
