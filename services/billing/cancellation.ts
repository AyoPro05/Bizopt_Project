import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { requireCapability } from "@/lib/platform-permissions";
import { AppError } from "@/services/platform/errors";
import { requireVerifiedBillingUser } from "./access";
import { providerId } from "./lifecycle";
import { syncProviderSubscription } from "./webhook-handler";
/** Only period-end cancellation is exposed to self-service; refunds are a separate workflow. */
export async function setSubscriptionCancellation(orgId: string, actorId: string, cancel: boolean, confirmed: boolean) {
  if (confirmed !== true) throw new AppError("Confirm the effect on future recurring billing before continuing", 400);
  await requireCapability(orgId, actorId, "billing.manage");
  await requireVerifiedBillingUser(actorId);
  const subscriptionId = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${orgId}))`;
    const local = await tx.subscription.findUnique({ where: { orgId } });
    if (!local?.stripeSubscriptionId) throw new AppError("No subscription is available", 409);
    const sub = await stripe.subscriptions.retrieve(local.stripeSubscriptionId);
    if (providerId(sub.customer) !== local.stripeCustomerId) throw new AppError("Billing ownership changed; refresh Billing", 409);
    if (!["trialing", "active", "past_due"].includes(sub.status) || sub.current_period_end * 1000 <= Date.now() || sub.schedule || sub.pending_update) throw new AppError("This subscription needs billing review before cancellation or resuming is supported", 409);
    if (sub.cancel_at_period_end !== cancel) await stripe.subscriptions.update(sub.id, { cancel_at_period_end: cancel }, { idempotencyKey: `cancel-period-end:${sub.id}:${local.updatedAt?.getTime() ?? 0}:${cancel}` });
    return sub.id;
  }, { maxWait: 10000, timeout: 30000 });
  const confirmedSub = await syncProviderSubscription(orgId, subscriptionId);
  if (!confirmedSub || confirmedSub.cancel_at_period_end !== cancel) throw new AppError("The provider has not confirmed this change. Refresh Billing and retry.", 409);
  return { cancelAtPeriodEnd: confirmedSub.cancel_at_period_end, accessUntil: new Date((confirmedSub.status === "trialing" ? confirmedSub.trial_end ?? confirmedSub.current_period_end : confirmedSub.current_period_end) * 1000).toISOString() };
}
