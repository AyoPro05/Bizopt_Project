import { addDays } from "date-fns";
import { stripe, getPlanPriceId, getTrialFeePriceId } from "@/lib/stripe";
import { BILLING } from "@/lib/constants";
import { appUrl } from "@/lib/helpers";
import { db } from "@/lib/db";
import { AppError } from "@/services/platform/errors";
import { assertPlanPrice, getPlanDefinition, type PlanKey } from "./plans";

export async function createCheckoutSession(orgId: string, userId: string, email: string, options: { plan?: PlanKey; successUrl?: string; cancelUrl?: string } = {}) {
  const plan = getPlanDefinition(options.plan ?? "base");
  const priceId = getPlanPriceId(plan.key);
  assertPlanPrice(await stripe.prices.retrieve(priceId), plan);
  const trialFee = getTrialFeePriceId();
  if (trialFee) {
    const feePrice = await stripe.prices.retrieve(trialFee);
    if (!feePrice.active || feePrice.type !== "one_time" || feePrice.unit_amount !== BILLING.trialPriceCents || feePrice.currency !== plan.currency) throw new AppError("The configured trial fee must match the advertised one-time amount and currency", 409);
  }
  return db.$transaction(async tx => {
    // A workspace has one checkout authority even when two browser tabs choose different plans.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`;
    const subscription = await tx.subscription.findUnique({ where: { orgId } });
    if (subscription?.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(subscription.status)) throw new AppError("A subscription already exists. Use the approved plan-change flow.", 409);
    let customerId = subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email, metadata: { orgId, userId } }, { idempotencyKey: `workspace-customer:${orgId}` });
      customerId = customer.id;
      await tx.subscription.upsert({ where: { orgId }, create: { orgId, stripeCustomerId: customerId, planId: BILLING.planId, status: "pending_payment", currency: BILLING.currency, amountCents: BILLING.amountCents, trialPriceCents: BILLING.trialPriceCents, trialDays: BILLING.trialDays, requiresPaymentMethod: true }, update: { stripeCustomerId: customerId } });
    }
    const existingSubscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (existingSubscriptions.has_more) throw new AppError("Billing history needs reconciliation before another checkout", 409);
    if (existingSubscriptions.data.some(sub => !["canceled", "incomplete_expired"].includes(sub.status))) throw new AppError("A provider subscription already exists. Wait for billing reconciliation.", 409);
    const openSessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    if (openSessions.has_more) throw new AppError("Open checkout sessions need billing reconciliation", 409);
    const previous = openSessions.data.filter(session => session.mode === "subscription" || session.metadata?.orgId === orgId);
    const reusable = previous.find(session => session.metadata?.orgId === orgId && session.metadata?.plan === plan.key);
    if (reusable) return reusable;
    for (const session of previous) await stripe.checkout.sessions.expire(session.id);
    const lineItems = [{ price: priceId, quantity: 1 }];
    if (trialFee) lineItems.unshift({ price: trialFee, quantity: 1 });
    const metadata = { orgId, userId, plan: plan.key, capacity: String(plan.capacity), recurringCents: String(plan.amountCents), currency: plan.currency };
    const session = await stripe.checkout.sessions.create({ customer: customerId, mode: "subscription", line_items: lineItems, payment_method_collection: "always", success_url: options.successUrl ?? appUrl("/billing?checkout=success"), cancel_url: options.cancelUrl ?? appUrl("/billing?checkout=canceled"), subscription_data: { trial_period_days: BILLING.trialDays, metadata, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }, metadata, payment_method_types: ["card"], billing_address_collection: "auto" }, { idempotencyKey: `checkout:${orgId}:${plan.key}:${previous.map(row => row.id).sort().join("-") || Math.floor(Date.now() / 1800000)}` });
    await tx.subscription.update({ where: { orgId }, data: { requestedPlan: plan.key, trialStartAt: new Date(), trialEndAt: addDays(new Date(), BILLING.trialDays), requiresPaymentMethod: true, status: "pending_payment" } });
    // A selection and checkout redirect are not payment evidence. Only a verified provider state raises capacity.
    await tx.entitlement.upsert({ where: { orgId }, create: { orgId, active: false, deviceLimit: 1, planKey: "base", seatLimit: 2, userFacingState: "pending_payment" }, update: { userFacingState: "pending_payment" } });
    return session;
  }, { maxWait: 10000, timeout: 30000 });
}

export async function createPortalSession(orgId: string) {
  const subscription = await db.subscription.findUnique({ where: { orgId } });
  if (!subscription?.stripeCustomerId) throw new AppError("No billing account found", 409);
  const configurationId = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (!configurationId) throw new AppError("The payment portal needs a reviewed configuration before it can open", 409);
  const configuration = await stripe.billingPortal.configurations.retrieve(configurationId);
  if (!configuration.active || configuration.features.subscription_update.enabled) throw new AppError("Provider portal subscription changes must be disabled; use the approved plan-change flow", 409);
  return stripe.billingPortal.sessions.create({ customer: subscription.stripeCustomerId, return_url: appUrl("/billing"), configuration: configurationId });
}
