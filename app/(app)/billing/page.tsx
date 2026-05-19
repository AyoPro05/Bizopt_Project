import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { db } from "@/lib/db";
import { isRefundEligible } from "@/services/billing/refunds";
import { BillingPanel } from "@/components/billing/billing-panel";
import { AppTopbar } from "@/components/shell/app-topbar";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);
  const org = session?.user?.id ? await getUserPrimaryOrg(session.user.id) : null;
  if (!org) return <p>No workspace.</p>;

  const [subscription, entitlement, refundEligibility] = await Promise.all([
    db.subscription.findUnique({ where: { orgId: org.id } }),
    db.entitlement.findUnique({ where: { orgId: org.id } }),
    isRefundEligible(org.id),
  ]);

  return (
    <div>
      <AppTopbar title="Billing" />
      {params.checkout === "success" && (
        <p className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Checkout complete — syncing via webhook. Refresh if status hasn&apos;t updated.
        </p>
      )}
      <BillingPanel
        status={subscription?.status ?? "pending_payment"}
        userFacingState={entitlement?.userFacingState ?? "pending_payment"}
        currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
        trialEndAt={subscription?.trialEndAt ?? null}
        cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
        canRefund={refundEligibility.eligible}
      />
    </div>
  );
}
