import { describe, expect, it } from "vitest";
import { getPlanDefinition, assertPlanPrice, planForProviderPrice, assertChangeSupported, invoiceSummary, quoteHash } from "@/services/billing/plans";

const price = { id: "price_base", active: true, currency: "usd", unit_amount: 999, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } };

describe("fixed Base and Team plans", () => {
  it("includes the owner in Base capacity and preserves the configured recurring price", () => {
    expect(getPlanDefinition("base", 999, "usd")).toEqual({ key: "base", label: "Base", capacity: 2, amountCents: 999, currency: "usd", interval: "month" });
  });
  it("charges one fixed 140% Team subtotal using integer round-half-up", () => {
    expect(getPlanDefinition("team", 999, "usd")).toMatchObject({ capacity: 5, amountCents: 1399 });
    expect(getPlanDefinition("team", 1001, "gbp").amountCents).toBe(1401);
  });
  it("does not derive Team pricing from occupied headcount", () => {
    for (const occupied of [1, 2, 3, 4, 5]) expect({ occupied, plan: getPlanDefinition("team", 1000) }.plan.amountCents).toBe(1400);
  });
  it("refuses misconfigured provider price amounts, currencies and intervals", () => {
    const plan = getPlanDefinition("base", 999, "usd");
    expect(() => assertPlanPrice(price, plan)).not.toThrow();
    for (const mismatch of [{ unit_amount: 998 }, { currency: "gbp" }, { recurring: { interval: "year", interval_count: 1 } }, { recurring: { interval: "month", interval_count: 2 } }, { active: false }, { billing_scheme: "tiered" }]) {
      expect(() => assertPlanPrice({ ...price, ...mismatch }, plan)).toThrow("configured");
    }
  });
  it("refuses unknown or multiply billed provider prices", () => {
    expect(() => planForProviderPrice({ ...price, id: "unapproved" }, 1, { base: "price_base", team: "price_team" })).toThrow("approved");
    expect(() => planForProviderPrice(price, 2, { base: "price_base", team: "price_team" })).toThrow("quantity");
    expect(planForProviderPrice({ ...price, id: "price_team", unit_amount: 1399 }, 1, { base: "price_base", team: "price_team" }).capacity).toBe(5);
  });
  it("blocks trial, unpaid, discounted, multi-item and existing schedule changes", () => {
    const paid = { status: "active", collection_method: "charge_automatically", current_period_end: 9999999999, items: { data: [{ price, quantity: 1 }] }, discounts: [], pending_update: null, schedule: null, latest_invoice: { paid: true } };
    expect(() => assertChangeSupported(paid)).not.toThrow();
    for (const change of [{ status: "trialing" }, { status: "past_due" }, { discounts: ["discount"] }, { schedule: "sched_other" }, { pending_update: {} }, { latest_invoice: { paid: false } }, { items: { data: [] } }]) expect(() => assertChangeSupported({ ...paid, ...change })).toThrow();
  });
  it("binds exact provider totals, line items, tax, discounts and proration approval", () => {
    const invoice = { id: "preview_1", currency: "usd", amount_due: 200, subtotal: 180, total: 200, total_tax_amounts: [{ amount: 20 }], total_discount_amounts: [], lines: { has_more: false, data: [{ description: "Remaining Team", amount: 200, proration: true, period: { start: 10, end: 100 } }] } };
    const summary = invoiceSummary(invoice);
    expect(summary).toMatchObject({ invoiceId: "preview_1", amountDueCents: 200, taxCents: 20, discountCents: 0 });
    expect(quoteHash({ ...summary, prorationDate: 10 })).not.toBe(quoteHash({ ...summary, prorationDate: 11 }));
    expect(quoteHash(summary)).not.toBe(quoteHash({ ...summary, amountDueCents: 201 }));
    expect(() => invoiceSummary({ ...invoice, lines: { ...invoice.lines, has_more: true } })).toThrow("complete");
  });
});
