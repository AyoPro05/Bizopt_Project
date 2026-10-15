import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, provider, reconcile } = vi.hoisted(() => ({ db: { subscription: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() }, entitlement: { upsert: vi.fn(), updateMany: vi.fn() }, auditLog: { create: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn() }, provider: { subscriptions: { retrieve: vi.fn() } }, reconcile: vi.fn() }));
vi.mock("@/lib/db", () => ({ db })); vi.mock("@/lib/stripe", () => ({ stripe: provider }));
vi.mock("@/services/billing/plan-changes", () => ({ reconcilePlanSubscription: reconcile, BillingCapacityConflict: class BillingCapacityConflict extends Error {} }));
vi.mock("@/services/billing/payments", () => ({ recordPaymentFromInvoice: vi.fn(), recordPaymentIntent: vi.fn() }));
vi.mock("@/services/billing/refunds", () => ({ syncRefundFromStripe: vi.fn() }));
import { processStripeEvent } from "@/services/billing/webhook-handler";
const remote = { id: "sub_a", customer: "cus_a", status: "active", metadata: { orgId: "org_a" }, items: { data: [{ price: { id: "price_base", unit_amount: 999, currency: "usd" } }] }, current_period_start: 100, current_period_end: 9999999999, cancel_at_period_end: false };
describe("authoritative webhook reconciliation", () => {
  beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db)); db.subscription.findUnique.mockResolvedValue({ id: "local", orgId: "org_a", stripeSubscriptionId: "sub_a", stripeCustomerId: "cus_a" }); db.subscription.findFirst.mockResolvedValue({ orgId: "org_a", stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_a" }); db.subscription.upsert.mockResolvedValue({ id: "local" }); provider.subscriptions.retrieve.mockResolvedValue(remote); });
  it("retrieves current subscription instead of replaying an old price or status", async () => {
    await processStripeEvent({ id: "evt_old", type: "customer.subscription.updated", data: { object: { ...remote, status: "trialing" } } } as never);
    expect(provider.subscriptions.retrieve).toHaveBeenCalledWith("sub_a", expect.objectContaining({ expand: expect.arrayContaining(["latest_invoice"]) }));
    expect(reconcile).toHaveBeenCalledWith("org_a", remote, db);
  });
  it("does not trust metadata pointing a verified customer at a different tenant", async () => {
    db.subscription.findUnique.mockResolvedValue({ orgId: "org_b", stripeCustomerId: "cus_b" }); db.subscription.findFirst.mockResolvedValue(null);
    await processStripeEvent({ id: "evt_forged", type: "customer.subscription.updated", data: { object: { ...remote, metadata: { orgId: "org_b" } } } } as never);
    expect(reconcile).not.toHaveBeenCalled();
  });
  it("reconciles invoice events from current provider state without granting access from old paid invoices", async () => {
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "past_due" });
    await processStripeEvent({ id: "evt_invoice", type: "invoice.payment_succeeded", data: { object: { id: "old_invoice", customer: "cus_a", subscription: "sub_a", paid: true } } } as never);
    expect(reconcile).toHaveBeenCalledWith("org_a", expect.objectContaining({ status: "past_due" }), db);
    expect(db.entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ userFacingState: "grace_period" }) }));
  });
});
