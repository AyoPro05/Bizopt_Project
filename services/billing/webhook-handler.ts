import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { BILLING } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { getPlanDefinition, planForProviderPrice } from "./plans";
import { upsertSubscriptionFromStripe } from "./subscriptions";
import { recordPaymentFromInvoice } from "./payments";
import { syncRefundFromStripe, syncRefund } from "./refunds";
import { emitBillingEvent } from "./events";
import { emitEvent } from "@/services/automation/events";
import { classifyInvoice, hasPaidAccess, introductoryReminderDue, invoiceIsPaid, invoicePeriod, providerId } from "./lifecycle";
import { BillingCapacityConflict, reconcilePlanSubscription } from "./plan-changes";

async function resolveOrgIdFromStripe(customerId: string, metadataOrgId?: string | null) {
  if (!customerId) return null;
  if (metadataOrgId) {
    const local = await db.subscription.findUnique({ where: { orgId: metadataOrgId } });
    if (local?.stripeCustomerId === customerId) return metadataOrgId;
  }
  return (await db.subscription.findFirst({ where: { stripeCustomerId: customerId } }))?.orgId ?? null;
}
async function currentInvoices(subscriptionId: string) {
  const invoices: Stripe.Invoice[] = [];
  let cursor: string | undefined;
  // Bound unexpectedly large histories for explicit operations review rather than partial evidence.
  for (let page = 0; page < 50; page++) {
    const batch = await stripe.invoices.list({ subscription: subscriptionId, limit: 100, ...(cursor ? { starting_after: cursor } : {}), expand: ["data.payment_intent"] });
    for (const invoice of batch.data) {
      if (invoice.lines.has_more) {
        const lines: Stripe.InvoiceLineItem[] = [];
        for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) lines.push(line);
        invoice.lines = { ...invoice.lines, data: lines, has_more: false };
      }
      invoices.push(invoice);
    }
    if (!batch.has_more) return invoices;
    cursor = batch.data.at(-1)?.id;
    if (!cursor) break;
  }
  throw new Error("Subscription invoice history requires billing review before reconciliation");
}
export async function syncProviderSubscription(orgId: string, subscriptionId: string) {
  try { return await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${orgId}))`;
    const local = await tx.subscription.findUnique({ where: { orgId } });
    if (!local || (local.stripeSubscriptionId && local.stripeSubscriptionId !== subscriptionId)) return;
    // Retrieve only after locking: event snapshots cannot roll back paid rows or entitlements.
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice.payment_intent", "default_payment_method"] });
    if (local.stripeCustomerId !== providerId(sub.customer)) throw new Error("Provider subscription ownership mismatch");
    if (!local.stripeSubscriptionId && local.checkoutConsentId !== sub.metadata?.consentId) return;
    const consent = sub.metadata?.consentId ? await tx.commercialConsent.findFirst({ where: { id: sub.metadata.consentId, orgId, userId: sub.metadata.userId, checkoutIntentId: sub.metadata.checkoutIntentId } }) : null;
    if (!local.stripeSubscriptionId && (!consent || sub.metadata.orgId !== orgId)) throw new Error("Checkout subscription has no related accepted commercial terms");
    const invoices = await currentInvoices(sub.id);
    const record = await upsertSubscriptionFromStripe(orgId, sub, tx);
    const evidence = invoices.map(invoice => { const purpose = classifyInvoice(invoice, sub, consent); return { invoice, purpose, period: invoicePeriod(invoice, purpose, sub) }; });
    for (const row of evidence) await recordPaymentFromInvoice(orgId, row.invoice, row.purpose, record.id, row.period, tx);
    const paid = evidence.filter(row => invoiceIsPaid(row.invoice) && row.period);
    const introductory = paid.find(row => row.purpose === "INTRODUCTORY");
    const recurring = paid.filter(row => row.purpose === "RECURRING").sort((a, b) => a.period!.start.getTime() - b.period!.start.getTime() || a.invoice.created - b.invoice.created);
    const firstRecurring = local.firstRecurringInvoiceId ?? recurring[0]?.invoice.id ?? null;
    const paidThroughMs = Math.max(local.paidThrough?.getTime() ?? 0, ...paid.filter(row => ["INTRODUCTORY", "RECURRING"].includes(row.purpose)).map(row => row.period!.end.getTime()));
    const paidThrough = paidThroughMs ? new Date(paidThroughMs) : null;
    const graceDays = BILLING.gracePeriodDays;
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) throw new Error("BILLING_GRACE_PERIOD_DAYS must be an integer between 0 and 30");
    // Grace is anchored to the confirmed paid end, never to a retry/webhook receipt time.
    const graceUntil = sub.status === "past_due" && paidThrough ? local.graceUntil ?? new Date(paidThrough.getTime() + graceDays * 86400_000) : null;
    const state = await tx.subscription.update({ where: { orgId }, data: {
      checkoutConsentId: consent?.id ?? local.checkoutConsentId,
      introductoryInvoiceId: introductory?.invoice.id ?? local.introductoryInvoiceId,
      introductoryPaidAt: introductory ? new Date((introductory.invoice.status_transitions?.paid_at ?? introductory.invoice.created) * 1000) : local.introductoryPaidAt,
      firstRecurringInvoiceId: firstRecurring, paidThrough, graceUntil,
      ...(firstRecurring && !local.trialConvertedAt && recurring[0] ? { trialConvertedAt: new Date((recurring[0].invoice.status_transitions?.paid_at ?? recurring[0].invoice.created) * 1000) } : {}),
    } });
    await reconcilePlanSubscription(orgId, sub, tx);
    const active = hasPaidAccess({ ...state, status: sub.status });
    const userFacingState = active ? sub.status === "past_due" ? "grace_period" : sub.status === "trialing" ? "trialing" : "active" : sub.status === "trialing" || sub.status === "incomplete" ? "pending_payment" : ["canceled", "unpaid", "incomplete_expired", "paused"].includes(sub.status) ? "canceled" : "past_due";
    const entitlement = { subscriptionId: record.id, active, userFacingState, accessUntil: active ? sub.status === "past_due" ? graceUntil ?? paidThrough : paidThrough : new Date() };
    await tx.entitlement.upsert({ where: { orgId }, create: { orgId, ...entitlement, deviceLimit: 1 }, update: entitlement });
    const plan = planForProviderPrice(sub.items.data[0].price, sub.items.data[0].quantity);
    const periodEnd = sub.status === "trialing" ? sub.trial_end : sub.current_period_end;
    const payload: Prisma.InputJsonObject = { plan: plan.label, currency: plan.currency, introductoryAmountMinor: 99, recurringAmountMinor: plan.amountCents, periodStart: new Date((sub.status === "trialing" ? sub.trial_start ?? sub.current_period_start : sub.current_period_start) * 1000).toISOString(), periodEnd: new Date((periodEnd ?? sub.current_period_end) * 1000).toISOString(), ...(!sub.cancel_at_period_end ? { nextBillingAt: new Date((periodEnd ?? sub.current_period_end) * 1000).toISOString() } : {}) };
    const notify = (type: string, key: string, extra: Prisma.InputJsonObject = {}) => emitBillingEvent(tx, orgId, sub.id, `billing.${type}`, key, { ...payload, ...extra });
    if (introductory && !local.introductoryPaidAt && sub.status === "trialing" && active) await notify("introductory_active", `introductory-active:${sub.id}:${introductory.invoice.id}`, { invoiceId: introductory.invoice.id, amountMinor: introductory.invoice.amount_paid, ...(introductory.invoice.hosted_invoice_url ? { invoiceUrl: introductory.invoice.hosted_invoice_url } : {}) });
    const latestId = providerId(sub.latest_invoice);
    const current = evidence.find(row => row.invoice.id === latestId);
    const latestRecurring = recurring.find(row => row.invoice.id === latestId);
    if (latestRecurring && sub.status === "active" && active) {
      const recovered = local.status === "past_due" || !!local.graceUntil;
      const kind = recovered ? "payment_recovered" : latestId === firstRecurring ? "monthly_active" : "renewed";
      const key = `recurring-paid:${sub.id}:${latestId}`;
      // One logical transition can be retried, but must not become both recovery and activation later.
      if (recovered || local.firstRecurringInvoiceId !== latestId || latestId !== firstRecurring) await notify(kind, key, { invoiceId: latestRecurring.invoice.id, amountMinor: latestRecurring.invoice.amount_paid, periodStart: latestRecurring.period!.start.toISOString(), periodEnd: latestRecurring.period!.end.toISOString(), ...(latestRecurring.invoice.hosted_invoice_url ? { invoiceUrl: latestRecurring.invoice.hosted_invoice_url } : {}) });
    }
    if (current && !current.invoice.paid && current.purpose !== "OTHER" && !["void", "draft"].includes(current.invoice.status ?? "")) {
      const intent = typeof current.invoice.payment_intent === "object" ? current.invoice.payment_intent : null;
      const kind = intent?.status === "requires_action" ? "authentication_required" : current.invoice.attempt_count > 0 ? "payment_failed" : null;
      if (kind) await notify(kind, `${kind}:${current.invoice.id}`, { invoiceId: current.invoice.id, amountMinor: current.invoice.amount_due, ...(current.invoice.hosted_invoice_url ? { invoiceUrl: current.invoice.hosted_invoice_url } : {}), ...(graceUntil ? { graceUntil: graceUntil.toISOString() } : {}), accessUntil: entitlement.accessUntil?.toISOString() ?? null });
    }
    const cancelKey = `${sub.id}:${sub.cancel_at ?? sub.current_period_end}:${sub.canceled_at ?? 0}`;
    if (sub.cancel_at_period_end && !local.cancelAtPeriodEnd) await notify("cancellation_scheduled", `cancellation-scheduled:${cancelKey}`);
    if (!sub.cancel_at_period_end && local.cancelAtPeriodEnd && ["active", "trialing"].includes(sub.status)) await notify("resumed", `resumed:${sub.id}:${local.canceledAt?.toISOString() ?? local.currentPeriodEnd?.toISOString() ?? sub.current_period_end}`);
    if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(sub.status) && (local.paidThrough || local.introductoryPaidAt)) await notify("ended", `ended:${sub.id}`);
    if (introductoryReminderDue({ ...state, status: sub.status, trialEndAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null, cancelAtPeriodEnd: sub.cancel_at_period_end })) await notify("introductory_ending", `trial-reminder:${sub.id}:${sub.trial_end}`);
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
    const orgId = await resolveOrgIdFromStripe(providerId(snapshot.customer) ?? "", snapshot.metadata?.orgId);
    if (orgId) await syncProviderSubscription(orgId, snapshot.id);
    return;
  }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orgId = await resolveOrgIdFromStripe(providerId(session.customer) ?? "", session.metadata?.orgId);
    if (orgId && providerId(session.subscription)) await syncProviderSubscription(orgId, providerId(session.subscription)!);
    return;
  }
  if (["invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed", "invoice.payment_action_required"].includes(event.type)) {
    const snapshot = event.data.object as Stripe.Invoice;
    const orgId = await resolveOrgIdFromStripe(providerId(snapshot.customer) ?? "", snapshot.metadata?.orgId);
    if (orgId && providerId(snapshot.subscription)) await syncProviderSubscription(orgId, providerId(snapshot.subscription)!);
    return;
  }
  if (["refund.created", "refund.updated", "refund.failed"].includes(event.type)) { await syncRefund((event.data.object as Stripe.Refund).id); return; }
  if (event.type === "charge.refunded") { await syncRefundFromStripe(event.data.object as Stripe.Charge); return; }
  if (event.type.startsWith("charge.dispute.")) {
    const snapshot = event.data.object as Stripe.Dispute;
    const dispute = await stripe.disputes.retrieve(snapshot.id);
    if (!["warning_needs_response", "needs_response", "under_review", "warning_under_review", "lost"].includes(dispute.status)) return;
    const disputeIntentId = providerId(dispute.payment_intent);
    if (!disputeIntentId) return;
    const payment = await db.payment.findFirst({ where: { stripePaymentIntentId: disputeIntentId } });
    if (!payment) return;
    await db.$transaction(async tx => {
      const staff = await tx.supportStaff.findMany({ where: { active: true, role: "support_admin" }, select: { userId: true } });
      await tx.auditLog.create({ data: { orgId: payment.orgId, action: "billing.dispute_review_required", entity: "dispute", entityId: dispute.id, metadata: { status: dispute.status } } });
      for (const admin of staff) await emitEvent(tx, { eventType: "billing.dispute", dedupeKey: `dispute:${dispute.id}:${dispute.status}:${admin.userId}`, userId: admin.userId, orgId: payment.orgId, aggregateType: "dispute", aggregateId: dispute.id, payload: { amountMinor: dispute.amount, currency: dispute.currency } });
    });
    return;
  }
  // An arbitrary successful PaymentIntent is never subscription entitlement evidence.
  if (event.type !== "payment_intent.succeeded") logger.debug("unhandled_stripe_event", { type: event.type });
}
