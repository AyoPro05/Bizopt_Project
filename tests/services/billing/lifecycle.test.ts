import { describe, expect, it } from "vitest";
import { classifyInvoice, hasPaidAccess, introductoryReminderDue, refundStatus } from "@/services/billing/lifecycle";
const ids = { base: "price_base", team: "price_team", introductory: "price_intro" };
const price = { id: ids.base, active: true, unit_amount: 999, currency: "usd", type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1 } };
const consent = { id: "consent_a", checkoutIntentId: "intent_a", planKey: "base", introductoryAmountMinor: 99, introductoryDurationDays: 7, recurringAmountMinor: 999, currency: "usd" };
const sub = { id: "sub_a", customer: "cus_a", metadata: { checkoutIntentId: "intent_a", consentId: "consent_a" } };
const intro = { id: "in_intro", customer: "cus_a", subscription: "sub_a", billing_reason: "subscription_create", amount_due: 99, amount_paid: 99, paid: true, status: "paid", currency: "usd", lines: { has_more: false, data: [{ amount: 99, quantity: 1, price: { ...price, id: ids.introductory, unit_amount: 99, type: "one_time", recurring: null }, period: { start: 100, end: 200 } }] } };
describe("billing evidence boundaries", () => {
  it("classifies the related consent-bound one-time initial invoice", () => {
    expect(classifyInvoice(intro as never, sub as never, consent, ids)).toBe("INTRODUCTORY");
  });
  it("rejects initial invoices without consent or matching subscription/customer", () => {
    expect(classifyInvoice(intro as never, sub as never, null, ids)).toBe("OTHER");
    expect(classifyInvoice({ ...intro, subscription: "sub_other" } as never, sub as never, consent, ids)).toBe("OTHER");
    expect(classifyInvoice({ ...intro, customer: "cus_other" } as never, sub as never, consent, ids)).toBe("OTHER");
    expect(classifyInvoice(intro as never, { ...sub, metadata: {} } as never, consent, ids)).toBe("OTHER");
  });
  it("uses recurring price and billing reason instead of amount to classify monthly payments", () => {
    const recurring = { ...intro, billing_reason: "subscription_cycle", amount_paid: 99, lines: { data: [{ price, amount: 99, quantity: 1, proration: false, subscription: "sub_a" }], has_more: false } };
    expect(classifyInvoice(recurring as never, sub as never, consent, ids)).toBe("RECURRING");
    expect(classifyInvoice({ ...recurring, billing_reason: "subscription_update" } as never, sub as never, consent, ids)).toBe("ADJUSTMENT");
  });
  it("never grants introductory access from trialing status alone or zero payment", () => {
    expect(hasPaidAccess({ status: "trialing", paidThrough: null }, 150_000)).toBe(false);
    expect(hasPaidAccess({ status: "trialing", paidThrough: new Date(200_000), introductoryPaidAt: null }, 150_000)).toBe(false);
    expect(hasPaidAccess({ status: "trialing", paidThrough: new Date(200_000), introductoryPaidAt: new Date(100_000) }, 150_000)).toBe(true);
  });
  it("preserves a valid paid period during failure and ends access at the anchored grace deadline", () => {
    expect(hasPaidAccess({ status: "past_due", paidThrough: new Date(200_000) }, 150_000)).toBe(true);
    expect(hasPaidAccess({ status: "past_due", paidThrough: new Date(100_000), graceUntil: new Date(200_000) }, 200_001)).toBe(false);
    expect(hasPaidAccess({ status: "canceled", paidThrough: new Date(200_000) }, 150_000)).toBe(false);
  });
  it("reminds within three days only while current paid introduction will convert", () => {
    const local = { status: "trialing", introductoryPaidAt: new Date(1), trialEndAt: new Date(500_000), cancelAtPeriodEnd: false, firstRecurringInvoiceId: null };
    expect(introductoryReminderDue(local, 250_000)).toBe(true);
    expect(introductoryReminderDue({ ...local, cancelAtPeriodEnd: true }, 250_000)).toBe(false);
    expect(introductoryReminderDue({ ...local, firstRecurringInvoiceId: "in_monthly" }, 250_000)).toBe(false);
    expect(introductoryReminderDue(local, 600_000)).toBe(false);
  });
  it("keeps pending and requires-action refunds separate from success", () => {
    expect(refundStatus("pending")).toBe("refund_pending");
    expect(refundStatus("requires_action")).toBe("refund_pending");
    expect(refundStatus("succeeded")).toBe("refunded");
    expect(refundStatus("failed")).toBe("refund_failed");
  });
});
it("does not classify an unrelated extra charge as a paid recurring service line", () => {
  const discounted = { ...intro, billing_reason: "subscription_cycle", amount_paid: 99, lines: { has_more: false, data: [{ price, quantity: 1, amount: 999, subscription: "sub_a", discount_amounts: [{ amount: 999 }] }, { price: { ...price, id: "price_unrelated", type: "one_time" }, amount: 99, quantity: 1 }] } };
  expect(classifyInvoice(discounted as never, sub as never, consent, ids)).toBe("OTHER");
});
