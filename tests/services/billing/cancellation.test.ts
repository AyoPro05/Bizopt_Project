import { beforeEach, expect, it, vi } from "vitest";
const { db, stripe, sync } = vi.hoisted(() => ({ db: { subscription: { findUnique: vi.fn() }, user: { findUnique: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }, stripe: { subscriptions: { retrieve: vi.fn(), update: vi.fn() } }, sync: vi.fn() }));
vi.mock("@/lib/db", () => ({ db })); vi.mock("@/lib/stripe", () => ({ stripe })); vi.mock("@/services/billing/webhook-handler", () => ({ syncProviderSubscription: sync })); vi.mock("@/lib/platform-permissions", () => ({ requireCapability: vi.fn() }));
import { setSubscriptionCancellation } from "@/services/billing/cancellation";
const remote = { id: "sub_a", customer: "cus_a", status: "trialing", cancel_at_period_end: false, current_period_end: 9999999999, schedule: null, pending_update: null };
beforeEach(() => { vi.clearAllMocks(); db.user.findUnique.mockResolvedValue({ emailVerified: new Date() }); db.subscription.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub_a", stripeCustomerId: "cus_a" }); stripe.subscriptions.retrieve.mockResolvedValue(remote); stripe.subscriptions.update.mockResolvedValue({ ...remote, cancel_at_period_end: true }); sync.mockResolvedValue({ ...remote, cancel_at_period_end: true }); db.$transaction.mockImplementation(fn => fn(db)); });
it("requires explicit confirmation and performs period-end cancellation", async () => {
  await expect(setSubscriptionCancellation("org_a", "owner", true, false)).rejects.toThrow("Confirm"); expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  expect(await setSubscriptionCancellation("org_a", "owner", true, true)).toMatchObject({ cancelAtPeriodEnd: true });
  expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_a", { cancel_at_period_end: true }, expect.objectContaining({ idempotencyKey: expect.any(String) }));
});
it("allows resuming a supported future cancellation with provider confirmation", async () => {
  stripe.subscriptions.retrieve.mockResolvedValue({ ...remote, cancel_at_period_end: true }); stripe.subscriptions.update.mockResolvedValue(remote); sync.mockResolvedValue(remote);
  expect(await setSubscriptionCancellation("org_a", "owner", false, true)).toMatchObject({ cancelAtPeriodEnd: false });
});
it("rejects canceled subscriptions and unverified billing actors", async () => {
  stripe.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "canceled" }); await expect(setSubscriptionCancellation("org_a", "owner", false, true)).rejects.toThrow("supported");
  db.user.findUnique.mockResolvedValue({ emailVerified: null }); await expect(setSubscriptionCancellation("org_a", "owner", true, true)).rejects.toMatchObject({ status: 403 });
});
