import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { requireCapability } from "@/lib/platform-permissions";
import { db } from "@/lib/db";
import { BILLING } from "@/lib/constants";
import { isRefundEligible } from "@/services/billing/refunds";
import { getPlanDefinition, type PlanKey } from "@/services/billing/plans";
import type { PlanQuote } from "@/services/billing/plan-changes";
import { BillingPanel } from "@/components/billing/billing-panel";
import { Callout } from "@/components/ui/callout";
import { AppTopbar } from "@/components/shell/app-topbar";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string }> }) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org || !session?.user?.id) return <p>No workspace.</p>;
  try { await requireCapability(org.id, session.user.id, "billing.manage"); }
  catch { return <div><AppTopbar title="Billing" /><Callout title="Billing is managed by your workspace owner or authorised administrator">Your role cannot view or change subscription billing.</Callout></div>; }
  const [subscription, entitlement, refundEligibility, occupied, reserved, savedQuote, reconciliationIssue, user, payments, consents] = await Promise.all([
    db.subscription.findUnique({ where: { orgId: org.id } }), db.entitlement.findUnique({ where: { orgId: org.id } }), isRefundEligible(org.id),
    db.orgMember.count({ where: { orgId: org.id } }), db.workspaceInvite.count({ where: { orgId: org.id, status: "pending", expiresAt: { gt: new Date() } } }),
    db.billingPlanChange.findFirst({ where: { orgId: org.id, actorId: session.user.id, OR: [{ status: { in: ["processing", "pending_payment"] } }, { status: "quoted", expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" } }),
    db.billingPlanChange.findFirst({ where: { orgId: org.id, status: "reconciliation_required" }, orderBy: { createdAt: "desc" } }),
    db.user.findUnique({ where: { id: session.user.id }, select: { emailVerified: true } }),
    db.payment.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 50, include: { refunds: { orderBy: { createdAt: "desc" } } } }),
    db.commercialConsent.findMany({ where: { orgId: org.id, providerCheckoutId: { not: null } }, orderBy: { acceptedAt: "desc" }, take: 5 }),
  ]);
  const selectedPlan: PlanKey = subscription?.selectedPlan === "team" ? "team" : "base";
  return <div><AppTopbar title="Billing" />
    {params.checkout === "success" && <Callout tone="info" title="Checkout returned" className="mb-6">Access and capacity update after verified provider confirmation. A checkout redirect alone does not confirm payment. Refresh to check the latest state.</Callout>}
    {reconciliationIssue && <Callout tone="danger" title="Billing reconciliation needs review" className="mb-6">The provider plan and occupied or reserved seats disagree. Paid access is suspended while the owner and billing operations resolve the conflict. No members were automatically removed. Contact support with your workspace details.</Callout>}
    <BillingPanel status={subscription?.status ?? "pending_payment"} userFacingState={entitlement?.userFacingState ?? "pending_payment"}
      currentPeriodEnd={subscription?.currentPeriodEnd ?? null} trialEndAt={subscription?.trialEndAt ?? null} cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false} canRefund={refundEligibility.reviewAvailable}
      plans={[getPlanDefinition("base"), getPlanDefinition("team")]} selectedPlan={selectedPlan} initialChoice={params.plan === "team" ? "team" : "base"}
      occupied={occupied} reserved={reserved} seatLimit={entitlement?.seatLimit ?? 2} hasSubscription={!!subscription?.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(subscription.status)}
      pendingPlan={subscription?.pendingPlan ?? null} pendingPlanEffectiveAt={subscription?.pendingPlanEffectiveAt ?? null} requestedPlan={subscription?.requestedPlan ?? null}
      savedQuote={savedQuote ? { id: savedQuote.id, payloadHash: savedQuote.payloadHash, quote: savedQuote.quote as unknown as PlanQuote, status: savedQuote.status, expiresAt: savedQuote.expiresAt.toISOString() } : null}
      verified={!!user?.emailVerified} introductoryConfigured={!!(process.env.STRIPE_INTRODUCTORY_PRICE_ID || process.env.STRIPE_TRIAL_FEE_PRICE_ID)} trialStartAt={subscription?.trialStartAt ?? null} accessUntil={entitlement?.accessUntil ?? null} recoveryUrl={payments.find(payment => ["failed", "authentication_required"].includes(payment.status))?.hostedInvoiceUrl ?? null} trialPriceCents={BILLING.trialPriceCents} trialDays={BILLING.trialDays} teamConfigured={!!process.env.STRIPE_TEAM_PRICE_ID} />
    <section className="mt-8 rounded-xl border border-[var(--color-border)] p-5" aria-labelledby="billing-history"><h2 id="billing-history" className="text-lg font-semibold">Billing history</h2><p className="mt-2 text-sm text-[var(--color-ink-muted)]">Recorded provider invoices and refund requests. Payment receipts and tax details are available from the invoice link. History may show pending reconciliation after checkout.</p>{!payments.length ? <p className="mt-4 text-sm">No provider invoices have been recorded.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--color-border)]"><th className="p-2">Recorded</th><th className="p-2">Purpose</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Invoice / refunds</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id} className="border-b border-[var(--color-border)]"><td className="p-2">{payment.createdAt.toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</td><td className="p-2">{payment.purpose.toLowerCase()}</td><td className="p-2 whitespace-nowrap">{new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.toUpperCase() }).format(payment.amountCents / 100)} {payment.currency.toUpperCase()}</td><td className="p-2">{payment.status.replaceAll("_", " ")}</td><td className="p-2">{payment.hostedInvoiceUrl && <a className="underline" href={payment.hostedInvoiceUrl}>View Stripe invoice</a>}{payment.servicePeriodEnd && <p className="mt-1 text-xs">Service through {payment.servicePeriodEnd.toLocaleDateString("en-GB", { timeZone: "Europe/London" })}</p>}{payment.refunds.map(refund => <p className="mt-1 text-xs" key={refund.id}>Refund: {refund.status.replaceAll("_", " ")} · {new Intl.NumberFormat("en-US", { style: "currency", currency: refund.currency.toUpperCase() }).format(refund.amountCents / 100)}</p>)}</td></tr>)}</tbody></table></div>}</section>
    {!!consents.length && <section className="mt-6 rounded-xl border border-[var(--color-border)] p-5"><h2 className="font-semibold">Accepted checkout terms</h2><ul className="mt-3 space-y-2 text-sm">{consents.map(consent => <li key={consent.id}>{consent.acceptedAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}: {consent.planKey} · {consent.introductoryAmountMinor / 100} {consent.currency.toUpperCase()} for {consent.introductoryDurationDays} days, then {consent.recurringAmountMinor / 100} {consent.currency.toUpperCase()}/month until canceled · offer {consent.offerVersion}, terms {consent.termsVersion}, renewal disclosure {consent.renewalDisclosureVersion}.</li>)}</ul></section>}
  </div>;
}
