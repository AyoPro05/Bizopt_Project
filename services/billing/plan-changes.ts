import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stripe, getPlanPriceId } from "@/lib/stripe";
import { requireCapability } from "@/lib/platform-permissions";
import { AppError } from "@/services/platform/errors";
import { logger } from "@/lib/logger";
import { hasPaidAccess } from "./lifecycle";
import { getPlanDefinition, assertPlanPrice, planForProviderPrice, assertChangeSupported, invoiceSummary, quoteHash, type PlanKey } from "./plans";

export class BillingCapacityConflict extends AppError {
  constructor(public readonly providerPlan: PlanKey) { super("Billing capacity conflict: the provider plan and occupied or reserved seats disagree. Billing operations must review this workspace.", 409); }
}
type Tx = Prisma.TransactionClient;
export type PlanQuote = ReturnType<typeof invoiceSummary> & { targetPlan: PlanKey; capacity: number; recurringCents: number; nextInvoiceTotalCents: number; nextInvoiceTaxCents: number; nextInvoiceDiscountCents: number; nextRenewal: number; effectiveAt: number; subscriptionId: string; sourcePriceId: string; targetPriceId: string; itemId: string; prorationDate: number | null; localVersion: string; providerVersion: string; automaticTax: boolean; defaultTaxRates: string[]; itemTaxRates: string[] };
const conflict = (message: string) => new AppError(message, 409);
const expanded = ["latest_invoice", "default_payment_method"];

export async function occupiedAndReserved(tx: Tx, orgId: string) {
  const [occupied, reserved] = await Promise.all([tx.orgMember.count({ where: { orgId } }), tx.workspaceInvite.count({ where: { orgId, status: "pending", expiresAt: { gt: new Date() } } })]);
  return { occupied, reserved, total: occupied + reserved };
}

function providerVersion(sub: Stripe.Subscription) {
  return quoteHash({ id: sub.id, status: sub.status, customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id, periodStart: sub.current_period_start, periodEnd: sub.current_period_end, anchor: sub.billing_cycle_anchor, items: sub.items.data.map(item => ({ id: item.id, price: item.price.id, amount: item.price.unit_amount, quantity: item.quantity })), discounts: sub.discounts, automaticTax: sub.automatic_tax, tax: sub.default_tax_rates, latestInvoice: typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id });
}

function assertOwnsProvider(local: { stripeCustomerId: string | null; stripeSubscriptionId: string | null }, remote: Stripe.Subscription) {
  const customerId = typeof remote.customer === "string" ? remote.customer : remote.customer.id;
  if (remote.id !== local.stripeSubscriptionId || customerId !== local.stripeCustomerId) throw conflict("Provider subscription ownership does not match this workspace");
}

async function makeQuote(orgId: string, targetPlan: PlanKey, prorationDate?: number): Promise<PlanQuote> {
  const local = await db.subscription.findUnique({ where: { orgId } });
  if (!local?.stripeSubscriptionId) throw conflict("Start a subscription before changing plan");
  if (local.pendingPlan || local.requestedPlan) throw conflict("A plan change is already pending. Complete, retry or cancel that change first.");
  const remote = await stripe.subscriptions.retrieve(local.stripeSubscriptionId, { expand: expanded });
  assertOwnsProvider(local, remote); assertChangeSupported(remote);
  const item = remote.items.data[0]; const current = planForProviderPrice(item.price, item.quantity);
  if (current.key === targetPlan) throw conflict("This plan is already active");
  const target = getPlanDefinition(targetPlan); const targetPrice = await stripe.prices.retrieve(getPlanPriceId(targetPlan));
  assertPlanPrice(targetPrice, target);
  if (current.key !== local.selectedPlan) throw conflict("Billing is still syncing. Refresh before changing plans.");
  if (targetPrice.tax_behavior !== item.price.tax_behavior) throw conflict("Plan tax configuration differs; billing review is required");
  if (item.discounts?.length) throw conflict("Item discounts require an approved discount policy");
  if (targetPlan === "base") {
    const seats = await occupiedAndReserved(db, orgId);
    if (seats.total > 2) throw conflict("Base requires at most 2 occupied or reserved seats. Remove members or revoke invitations first. Member removal takes effect immediately.");
  }
  const timestamp = targetPlan === "team" ? prorationDate ?? Math.floor(Date.now() / 1000) : null;
  const preview = targetPlan === "team"
    ? await stripe.invoices.createPreview({ customer: local.stripeCustomerId!, subscription: remote.id, subscription_details: { items: [{ id: item.id, price: targetPrice.id, quantity: 1 }], billing_cycle_anchor: "unchanged", proration_behavior: "always_invoice", proration_date: timestamp! } })
    : await stripe.invoices.createPreview({ customer: local.stripeCustomerId!, subscription: remote.id, subscription_details: { items: [{ id: item.id, price: targetPrice.id, quantity: 1 }], billing_cycle_anchor: "unchanged", proration_behavior: "none" } });
  const summary = invoiceSummary(preview);
  const renewal = targetPlan === "team" ? invoiceSummary(await stripe.invoices.createPreview({ customer: local.stripeCustomerId!, subscription: remote.id, subscription_details: { items: [{ id: item.id, price: targetPrice.id, quantity: 1 }], billing_cycle_anchor: "unchanged", proration_behavior: "none" } })) : summary;
  return { ...summary, nextInvoiceTotalCents: renewal.totalCents, nextInvoiceTaxCents: renewal.taxCents, nextInvoiceDiscountCents: renewal.discountCents, targetPlan, capacity: target.capacity, recurringCents: target.amountCents, nextRenewal: remote.current_period_end, effectiveAt: targetPlan === "base" ? remote.current_period_end : timestamp!, subscriptionId: remote.id, sourcePriceId: item.price.id, targetPriceId: targetPrice.id, itemId: item.id, prorationDate: timestamp, localVersion: local.updatedAt.toISOString(), providerVersion: providerVersion(remote), automaticTax: remote.automatic_tax?.enabled ?? false, defaultTaxRates: remote.default_tax_rates?.map(rate => rate.id) ?? [], itemTaxRates: item.tax_rates?.map(rate => rate.id) ?? [] };
}

export async function previewPlanChange(orgId: string, actorId: string, targetPlan: PlanKey) {
  await requireCapability(orgId, actorId, "billing.manage");
  const quote = await makeQuote(orgId, targetPlan);
  const local = await db.subscription.findUnique({ where: { orgId } });
  return db.billingPlanChange.create({ data: { orgId, actorId, subscriptionId: local!.id, action: targetPlan === "team" ? "upgrade" : "downgrade", targetPlan, quote: quote as unknown as Prisma.InputJsonValue, payloadHash: quoteHash(quote), prorationDate: quote.prorationDate, amountDueCents: targetPlan === "team" ? quote.amountDueCents : 0, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
}

function compareQuote(quote: PlanQuote, refreshed: PlanQuote) {
  // Preview IDs identify a transient provider response; financial and subscription values must match exactly.
  if (quoteHash({ ...quote, invoiceId: null }) !== quoteHash({ ...refreshed, invoiceId: null })) throw conflict("The quoted amount or subscription changed. Refresh the quote and approve it again.");
}

export async function approvePlanChange(orgId: string, actorId: string, quoteId: string, payloadHash: string) {
  await requireCapability(orgId, actorId, "billing.manage");
  const record = await db.billingPlanChange.findFirst({ where: { id: quoteId, orgId, actorId } });
  if (!record) throw new AppError("Plan approval not found", 404);
  if (record.payloadHash !== payloadHash) throw conflict("The approval does not match this quote");
  if (record.status === "quoted" && record.expiresAt.getTime() <= Date.now()) throw conflict("This quote expired. Refresh it before approval.");
  const quote = record.quote as unknown as PlanQuote;
  if (quoteHash(quote) !== payloadHash) throw conflict("The stored approval payload changed");
  if (["complete", "scheduled", "cancelled"].includes(record.status)) return { status: record.status, paymentUrl: null };
  if (record.status === "quoted") {
    compareQuote(quote, await makeQuote(orgId, quote.targetPlan, quote.prorationDate ?? undefined));
    await db.$transaction(async tx => {
      await requireCapability(orgId, actorId, "billing.manage");
      const local = await tx.subscription.findUnique({ where: { orgId } });
      if (!local || local.updatedAt.toISOString() !== quote.localVersion || local.requestedPlan || local.pendingPlan) throw conflict("The subscription changed. Refresh the quote.");
      if (quote.targetPlan === "base" && (await occupiedAndReserved(tx, orgId)).total > 2) throw conflict("Base requires at most 2 occupied or reserved seats");
      const claimed = await tx.billingPlanChange.updateMany({ where: { id: quoteId, orgId, actorId, status: "quoted", payloadHash, expiresAt: { gt: new Date() } }, data: { status: "processing" } });
      if (claimed.count !== 1) throw conflict("This approval is already being processed. Retry the same approval.");
      // Reserve the future ceiling before a provider call so simultaneous invites cannot exceed it.
      await tx.subscription.update({ where: { orgId }, data: quote.targetPlan === "base" ? { requestedPlan: "base", pendingPlan: "base", pendingPlanEffectiveAt: new Date(quote.effectiveAt * 1000) } : { requestedPlan: "team" } });
    }, { isolationLevel: "Serializable" });
  } else if (!["processing", "pending_payment"].includes(record.status)) throw conflict("This quote cannot be reused. Request a new quote.");
  // Retrying exactly the same approved command reuses Stripe's idempotency key. Never create a second upgrade invoice.
  if (Date.now() - record.createdAt.getTime() > 23 * 60 * 60 * 1000 && record.status !== "pending_payment") throw conflict("The provider result needs billing review before retrying");
  if (record.status === "pending_payment") return reconcilePendingApproval(orgId, quoteId);
  try {
    if (quote.targetPlan === "team") {
      const updated = await stripe.subscriptions.update(quote.subscriptionId, { items: [{ id: quote.itemId, price: quote.targetPriceId, quantity: 1 }], payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice", proration_date: quote.prorationDate!, billing_cycle_anchor: "unchanged", expand: ["latest_invoice"] }, { idempotencyKey: `plan-change:${quoteId}:upgrade` });
      const invoice = typeof updated.latest_invoice === "object" ? updated.latest_invoice : null;
      await db.billingPlanChange.update({ where: { id: quoteId }, data: { status: updated.pending_update ? "pending_payment" : "processing", providerId: invoice?.id ?? null } });
      await db.subscription.update({ where: { orgId }, data: { pendingUpgradeInvoiceId: invoice?.id ?? null } });
      if (!updated.pending_update) await reconcileAuthoritativeSubscription(orgId);
      return { status: updated.pending_update ? "pending_payment" : "syncing", paymentUrl: invoice?.hosted_invoice_url ?? null };
    }
    let scheduleId = record.providerId;
    if (!scheduleId) {
      const schedule = await stripe.subscriptionSchedules.create({ from_subscription: quote.subscriptionId }, { idempotencyKey: `plan-change:${quoteId}:schedule` });
      scheduleId = schedule.id;
      await db.billingPlanChange.update({ where: { id: quoteId }, data: { providerId: scheduleId } });
      await db.subscription.update({ where: { orgId }, data: { stripeScheduleId: scheduleId } });
    }
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
    if (schedule.status !== "active" || !schedule.current_phase) throw conflict("The provider schedule cannot be changed safely; billing review is required");
    await stripe.subscriptionSchedules.update(scheduleId, { end_behavior: "release", proration_behavior: "none", phases: [{ start_date: schedule.current_phase.start_date, end_date: quote.effectiveAt, items: [{ price: quote.sourcePriceId, quantity: 1, ...(quote.itemTaxRates.length ? { tax_rates: quote.itemTaxRates } : {}) }], automatic_tax: { enabled: quote.automaticTax }, default_tax_rates: quote.defaultTaxRates, proration_behavior: "none" }, { start_date: quote.effectiveAt, iterations: 1, items: [{ price: quote.targetPriceId, quantity: 1, ...(quote.itemTaxRates.length ? { tax_rates: quote.itemTaxRates } : {}) }], automatic_tax: { enabled: quote.automaticTax }, default_tax_rates: quote.defaultTaxRates, proration_behavior: "none" }] }, { idempotencyKey: `plan-change:${quoteId}:phases` });
    const confirmed = await stripe.subscriptionSchedules.retrieve(scheduleId);
    if (!confirmed.phases.some(phase => phase.start_date === quote.effectiveAt && phase.items.some(item => (typeof item.price === "string" ? item.price : item.price.id) === quote.targetPriceId))) throw conflict("The provider has not confirmed this downgrade. Retry the same approval.");
    await db.billingPlanChange.update({ where: { id: quoteId }, data: { status: "scheduled", providerId: scheduleId } });
    await db.auditLog.create({ data: { orgId, userId: actorId, action: "billing.downgrade_scheduled", entity: "subscription", entityId: quote.subscriptionId, metadata: { effectiveAt: quote.effectiveAt, targetPlan: "base" } } });
    return { status: "scheduled", paymentUrl: null };
  } catch (error) {
    // An HTTP timeout cannot establish whether Stripe applied the request. Keep the claim and retry its key.
    await db.billingPlanChange.update({ where: { id: quoteId }, data: { error: "Provider confirmation is incomplete; retry this approved change" } });
    throw error;
  }
}

async function reconcilePendingApproval(orgId: string, quoteId: string) {
  const sub = await reconcileAuthoritativeSubscription(orgId);
  const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
  if (!sub.pending_update) {
    const local = await db.subscription.findUnique({ where: { orgId } });
    const complete = local?.selectedPlan === "team";
    await db.billingPlanChange.update({ where: { id: quoteId }, data: { status: complete ? "complete" : "expired", error: complete ? null : "The unpaid upgrade expired; request a new quote" } });
    if (!complete) await db.subscription.update({ where: { orgId }, data: { requestedPlan: null, pendingUpgradeInvoiceId: null } });
    return { status: complete ? "complete" : "expired", paymentUrl: null };
  }
  return { status: "pending_payment", paymentUrl: invoice?.hosted_invoice_url ?? null };
}

export async function cancelScheduledDowngrade(orgId: string, actorId: string) {
  await requireCapability(orgId, actorId, "billing.manage");
  const local = await db.subscription.findUnique({ where: { orgId } });
  if (local?.pendingPlan !== "base" || !local.stripeScheduleId || !local.pendingPlanEffectiveAt || local.pendingPlanEffectiveAt.getTime() <= Date.now()) throw conflict("No cancellable future downgrade is confirmed");
  const remote = await stripe.subscriptions.retrieve(local.stripeSubscriptionId!, { expand: expanded }); assertOwnsProvider(local, remote);
  if (planForProviderPrice(remote.items.data[0].price, remote.items.data[0].quantity).key !== "team") throw conflict("Provider plan already changed. Reconcile billing before cancellation.");
  const schedule = await stripe.subscriptionSchedules.retrieve(local.stripeScheduleId);
  if (schedule.status === "active") await stripe.subscriptionSchedules.release(schedule.id, {}, { idempotencyKey: `plan-cancel:${schedule.id}` });
  else if (schedule.status !== "released") throw conflict("The provider schedule is no longer cancellable");
  const confirmed = await stripe.subscriptionSchedules.retrieve(schedule.id);
  const confirmedSub = await stripe.subscriptions.retrieve(local.stripeSubscriptionId!, { expand: expanded });
  if (confirmed.status !== "released" || confirmedSub.schedule || planForProviderPrice(confirmedSub.items.data[0].price, confirmedSub.items.data[0].quantity).key !== "team") throw conflict("Cancellation is not confirmed by the provider. Retry without creating another subscription.");
  await db.$transaction(async tx => {
    await tx.subscription.update({ where: { orgId }, data: { pendingPlan: null, pendingPlanEffectiveAt: null, stripeScheduleId: null, requestedPlan: null } });
    await tx.billingPlanChange.updateMany({ where: { orgId, providerId: schedule.id }, data: { status: "cancelled" } });
    await tx.auditLog.create({ data: { orgId, userId: actorId, action: "billing.downgrade_cancelled", entity: "subscription", entityId: remote.id } });
  }, { isolationLevel: "Serializable" });
  return { status: "cancelled" };
}

export async function reconcileAuthoritativeSubscription(orgId: string) {
  const local = await db.subscription.findUnique({ where: { orgId } });
  if (!local?.stripeSubscriptionId) throw conflict("Subscription is awaiting checkout confirmation");
  const { syncProviderSubscription } = await import("./webhook-handler");
  const remote = await syncProviderSubscription(orgId, local.stripeSubscriptionId);
  if (!remote) throw conflict("Subscription ownership changed during billing reconciliation");
  return remote;
}

/** Called only with a retrieved provider subscription, never the stale subscription in an event payload. */
export async function reconcilePlanSubscription(orgId: string, sub: Stripe.Subscription, transaction?: Tx) {
  if (sub.items.data.length !== 1) throw conflict("Unexpected provider items; billing reconciliation requires review");
  const plan = planForProviderPrice(sub.items.data[0].price, sub.items.data[0].quantity);
  const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
  const confirmed = sub.status === "trialing" || (sub.status === "active" && !sub.pending_update && !!invoice?.paid && invoice.amount_paid > 0);
  if (!confirmed) return;
  try {
    const apply = async (tx: Tx) => {
      const local = await tx.subscription.findUnique({ where: { orgId } });
      if (!local) throw conflict("Workspace billing record not found");
      assertOwnsProvider(local, sub);
      if (!hasPaidAccess({ ...local, status: sub.status })) return;
      const seats = await occupiedAndReserved(tx, orgId);
      if (seats.total > plan.capacity) throw new BillingCapacityConflict(plan.key);
      const planChanged = local.selectedPlan !== plan.key;
      const finishingDowngrade = local.pendingPlan === "base" && plan.key === "base";
      await tx.subscription.update({ where: { orgId }, data: { selectedPlan: plan.key, amountCents: plan.amountCents, currency: plan.currency, lastPlanEventAt: new Date(), ...(planChanged || finishingDowngrade || local.requestedPlan === plan.key ? { requestedPlan: null, pendingUpgradeInvoiceId: null } : {}), ...(finishingDowngrade ? { pendingPlan: null, pendingPlanEffectiveAt: null, stripeScheduleId: null } : {}) } });
      const entitlement = { subscriptionId: local.id, active: true, planKey: plan.key, seatLimit: plan.capacity, accessUntil: new Date((sub.status === "trialing" ? sub.trial_end ?? sub.current_period_end : sub.current_period_end) * 1000), userFacingState: sub.status === "trialing" ? "trialing" : "active" };
      await tx.entitlement.upsert({ where: { orgId }, create: { orgId, ...entitlement, deviceLimit: 1 }, update: entitlement });
      if (planChanged || finishingDowngrade) await tx.billingPlanChange.updateMany({ where: { orgId, targetPlan: plan.key, status: { in: ["processing", "pending_payment", "scheduled", "reconciliation_required"] } }, data: { status: "complete", error: null } });
    };
    if (transaction) await apply(transaction);
    else await db.$transaction(apply, { isolationLevel: "Serializable" });
  } catch (error) {
    logger.error("billing_plan_reconciliation_conflict", { orgId, subscriptionId: sub.id, plan: plan.key });
    await db.auditLog.create({ data: { orgId, action: "billing.reconciliation_conflict", entity: "subscription", entityId: sub.id, metadata: { providerPlan: plan.key, requiredCapacity: plan.capacity } } });
    throw error;
  }
}
