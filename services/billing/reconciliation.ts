import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { syncProviderSubscription } from "./webhook-handler";
/** Repeated independently scheduled runs provide reminder and grace-expiry fallback. */
export async function reconcileBillingBatch() {
  const before = new Date(Date.now() - 15 * 60_000);
  const rows = await db.subscription.findMany({ where: { stripeSubscriptionId: { not: null }, status: { notIn: ["canceled", "incomplete_expired"] }, OR: [{ lastReconciliationAttemptAt: null }, { lastReconciliationAttemptAt: { lt: before } }] }, orderBy: [{ lastReconciliationAttemptAt: { sort: "asc", nulls: "first" } }, { id: "asc" }], take: 20, select: { orgId: true, stripeSubscriptionId: true } });
  let failed = 0;
  for (const row of rows) {
    try {
      await db.subscription.update({ where: { orgId: row.orgId }, data: { lastReconciliationAttemptAt: new Date() } });
      await syncProviderSubscription(row.orgId, row.stripeSubscriptionId!);
    } catch {
      failed++;
      logger.error("billing_state_reconciliation_failed", { orgId: row.orgId });
    }
  }
  return { checked: rows.length, failed };
}
