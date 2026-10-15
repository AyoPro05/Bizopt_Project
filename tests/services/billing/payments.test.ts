import { beforeEach, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { payment: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
import { recordPaymentFromInvoice } from "@/services/billing/payments";
beforeEach(() => vi.clearAllMocks());
it("updates the same invoice payment row when a PaymentIntent is attached after initial invoice creation", async () => {
  db.payment.findFirst.mockResolvedValue({ id: "payment_a", orgId: "org_a", stripeInvoiceId: "in_a", stripePaymentIntentId: "inv_in_a" });
  await recordPaymentFromInvoice("org_a", { id: "in_a", payment_intent: "pi_a", paid: true, status: "paid", amount_due: 99, amount_paid: 99, currency: "usd" } as never, "INTRODUCTORY", "local_sub", null, db as never);
  expect(db.payment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "payment_a" }, data: expect.objectContaining({ stripePaymentIntentId: "pi_a", status: "succeeded" }) })); expect(db.payment.upsert).not.toHaveBeenCalled();
});
