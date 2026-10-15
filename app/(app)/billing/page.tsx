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
  const [subscription, entitlement, refundEligibility, occupied, reserved, savedQuote, reconciliationIssue] = await Promise.all([
    db.subscription.findUnique({ where: { orgId: org.id } }), db.entitlement.findUnique({ where: { orgId: org.id } }), isRefundEligible(org.id),
    db.orgMember.count({ where: { orgId: org.id } }), db.workspaceInvite.count({ where: { orgId: org.id, status: "pending", expiresAt: { gt: new Date() } } }),
    db.billingPlanChange.findFirst({ where: { orgId: org.id, actorId: session.user.id, OR: [{ status: { in: ["processing", "pending_payment"] } }, { status: "quoted", expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: "desc" } }),
    db.billingPlanChange.findFirst({ where: { orgId: org.id, status: "reconciliation_required" }, orderBy: { createdAt: "desc" } }),
  ]);
  const selectedPlan: PlanKey = subscription?.selectedPlan === "team" ? "team" : "base";
  return <div><AppTopbar title="Billing" />
    {params.checkout === "success" && <Callout tone="info" title="Checkout returned" className="mb-6">Access and capacity update after verified provider confirmation. A checkout redirect alone does not confirm payment. Refresh to check the latest state.</Callout>}
    {reconciliationIssue && <Callout tone="danger" title="Billing reconciliation needs review" className="mb-6">The provider plan and occupied or reserved seats disagree. Paid access is suspended while the owner and billing operations resolve the conflict. No members were automatically removed. Contact support with your workspace details.</Callout>}
    <BillingPanel status={subscription?.status ?? "pending_payment"} userFacingState={entitlement?.userFacingState ?? "pending_payment"}
      currentPeriodEnd={subscription?.currentPeriodEnd ?? null} trialEndAt={subscription?.trialEndAt ?? null} cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false} canRefund={refundEligibility.eligible}
      plans={[getPlanDefinition("base"), getPlanDefinition("team")]} selectedPlan={selectedPlan} initialChoice={params.plan === "team" ? "team" : "base"}
      occupied={occupied} reserved={reserved} seatLimit={entitlement?.seatLimit ?? 2} hasSubscription={!!subscription?.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(subscription.status)}
      pendingPlan={subscription?.pendingPlan ?? null} pendingPlanEffectiveAt={subscription?.pendingPlanEffectiveAt ?? null} requestedPlan={subscription?.requestedPlan ?? null}
      savedQuote={savedQuote ? { id: savedQuote.id, payloadHash: savedQuote.payloadHash, quote: savedQuote.quote as unknown as PlanQuote, status: savedQuote.status, expiresAt: savedQuote.expiresAt.toISOString() } : null}
      trialPriceCents={process.env.STRIPE_TRIAL_FEE_PRICE_ID ? BILLING.trialPriceCents : 0} trialDays={BILLING.trialDays} teamConfigured={!!process.env.STRIPE_TEAM_PRICE_ID} />
  </div>;
}
