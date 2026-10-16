import { beforeEach, expect, it, vi } from "vitest";
const { db, sync } = vi.hoisted(() => ({ db: { subscription: { findMany: vi.fn(), update: vi.fn() } }, sync: vi.fn() }));
vi.mock("@/lib/db", () => ({ db })); vi.mock("@/services/billing/webhook-handler", () => ({ syncProviderSubscription: sync }));
import { reconcileBillingBatch } from "@/services/billing/reconciliation";
beforeEach(() => { vi.clearAllMocks(); db.subscription.findMany.mockResolvedValue([{ orgId: "a", stripeSubscriptionId: "sub_a" }, { orgId: "b", stripeSubscriptionId: "sub_b" }]); sync.mockResolvedValue({}); });
it("reconciles stored provider subscriptions in bounded batches, including reminder/grace fallback", async () => {
  expect(await reconcileBillingBatch()).toMatchObject({ checked: 2, failed: 0 }); expect(sync).toHaveBeenCalledWith("a", "sub_a"); expect(db.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
});
it("keeps checking other tenants when one provider lookup fails", async () => {
  sync.mockRejectedValueOnce(new Error("provider unavailable")); expect(await reconcileBillingBatch()).toMatchObject({ checked: 2, failed: 1 }); expect(sync).toHaveBeenCalledWith("b", "sub_b");
});
