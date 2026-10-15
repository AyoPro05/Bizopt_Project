import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, stripe, events } = vi.hoisted(() => ({ db: { subscription: { findUnique: vi.fn() }, payment: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn() }, refund: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() }, orgMember: { findMany: vi.fn() }, auditLog: { create: vi.fn() }, entitlement: { updateMany: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }, stripe: { refunds: { create: vi.fn(), retrieve: vi.fn(), list: vi.fn() } }, events: vi.fn() }));
vi.mock("@/lib/db", () => ({ db })); vi.mock("@/lib/stripe", () => ({ stripe })); vi.mock("@/services/automation/events", () => ({ emitEvent: events }));
import { createRefund, isRefundEligible, syncRefund } from "@/services/billing/refunds";
const payment = { id: "payment_a", orgId: "org_a", amountCents: 99, currency: "usd", stripePaymentIntentId: "pi_a", status: "succeeded", refunds: [] };
describe("reviewed refund policy and provider-confirmed lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("BILLING_AUTO_REFUND_POLICY_VERSION", ""); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db)); db.subscription.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub_a" }); db.payment.findFirst.mockResolvedValue(payment); db.payment.findUniqueOrThrow.mockResolvedValue(payment); db.orgMember.findMany.mockResolvedValue([{ userId: "owner" }]);
    db.refund.findFirst.mockResolvedValue(null); db.refund.create.mockResolvedValue({ id: "refund_a", status: "review_requested" }); db.refund.upsert.mockImplementation(async ({ create }) => ({ id: "refund_a", ...create }));
    stripe.refunds.retrieve.mockResolvedValue({ id: "re_a", payment_intent: "pi_a", status: "pending", amount: 99, currency: "usd" });
  });
  it("routes to support review without inventing a window or issuing a provider refund", async () => {
    expect(await isRefundEligible("org_a")).toMatchObject({ eligible: false, reviewAvailable: true });
    const result = await createRefund("payment_a", "customer request"); expect(result.record.status).toBe("review_requested"); expect(stripe.refunds.create).not.toHaveBeenCalled();
  });
  it("keeps pending provider refunds pending and never revokes access", async () => {
    await syncRefund("re_a");
    expect(db.refund.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "refund_pending" }) }));
    expect(events).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "billing.refund_pending" }));
    expect(events).not.toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "billing.refunded" })); expect(db.entitlement.updateMany).not.toHaveBeenCalled();
  });
  it("only confirmed success emits refunded and contains original payment reference", async () => {
    stripe.refunds.retrieve.mockResolvedValue({ id: "re_a", payment_intent: "pi_a", status: "succeeded", amount: 99, currency: "usd" });
    await syncRefund("re_a"); expect(events).toHaveBeenCalledWith(db, expect.objectContaining({ eventType: "billing.refunded", payload: expect.objectContaining({ amountMinor: 99, currency: "usd", paymentReference: "payment_a" }) })); expect(db.entitlement.updateMany).not.toHaveBeenCalled();
  });
});
