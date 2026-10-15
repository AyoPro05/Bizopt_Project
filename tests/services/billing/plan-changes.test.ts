import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, provider } = vi.hoisted(() => ({
  db: { subscription: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, entitlement: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() }, orgMember: { count: vi.fn() }, workspaceInvite: { count: vi.fn() }, billingPlanChange: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, auditLog: { create: vi.fn() }, $transaction: vi.fn() },
  provider: { prices: { retrieve: vi.fn() }, subscriptions: { retrieve: vi.fn(), update: vi.fn() }, invoices: { createPreview: vi.fn(), retrieve: vi.fn() }, subscriptionSchedules: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn(), release: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/stripe", () => ({ stripe: provider, getPlanPriceId: (key: string) => key === "team" ? "price_team" : "price_base" }));
vi.mock("@/lib/platform-permissions", () => ({ requireCapability: vi.fn().mockResolvedValue({ role: "owner" }) }));
import { previewPlanChange, approvePlanChange, reconcilePlanSubscription, cancelScheduledDowngrade } from "@/services/billing/plan-changes";
import { quoteHash } from "@/services/billing/plans";
const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 15;
const base = { id: "price_base", active: true, currency: "usd", unit_amount: 999, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } };
const team = { ...base, id: "price_team", unit_amount: 1399 };
const remote = { id: "sub_a", customer: "cus_a", status: "active", collection_method: "charge_automatically", current_period_start: periodEnd - 86400 * 30, current_period_end: periodEnd, billing_cycle_anchor: periodEnd - 86400 * 30, items: { data: [{ id: "si_a", price: base, quantity: 1 }] }, metadata: { orgId: "org_a" }, discounts: [], pending_update: null, schedule: null, latest_invoice: { id: "in_paid", paid: true, status: "paid", amount_paid: 999, amount_due: 999 }, cancel_at_period_end: false };
const local = { id: "local_sub", orgId: "org_a", stripeSubscriptionId: "sub_a", stripeCustomerId: "cus_a", selectedPlan: "base", requestedPlan: null, pendingPlan: null, updatedAt: new Date("2026-01-01"), currentPeriodEnd: new Date(periodEnd * 1000), paidThrough: new Date(periodEnd * 1000) };
const invoice = { id: "upcoming_a", currency: "usd", amount_due: 200, subtotal: 200, total: 200, total_tax_amounts: [], total_discount_amounts: [], lines: { has_more: false, data: [{ description: "Remaining Team less Base", amount: 200, proration: true, period: { start: periodEnd - 20, end: periodEnd } }] } };

describe("provider confirmed fixed plan changes", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("STRIPE_PRICE_ID", "price_base"); vi.stubEnv("STRIPE_TEAM_PRICE_ID", "price_team");
    db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
    db.subscription.findUnique.mockResolvedValue({ ...local }); db.subscription.update.mockResolvedValue(local); db.subscription.updateMany.mockResolvedValue({ count: 1 });
    db.entitlement.findUnique.mockResolvedValue({ active: true, planKey: "base", seatLimit: 2 }); db.entitlement.upsert.mockResolvedValue({});
    db.orgMember.count.mockResolvedValue(1); db.workspaceInvite.count.mockResolvedValue(0); db.billingPlanChange.findFirst.mockResolvedValue(null);
    db.billingPlanChange.create.mockImplementation(({ data }) => ({ id: "quote_a", status: "quoted", createdAt: new Date(), ...data })); db.billingPlanChange.updateMany.mockResolvedValue({ count: 1 });
    provider.prices.retrieve.mockImplementation((id: string) => Promise.resolve(id === "price_team" ? team : base)); provider.subscriptions.retrieve.mockResolvedValue(remote); provider.invoices.createPreview.mockResolvedValue(invoice);
  });
  it("previews the provider proration with unchanged anchor and one plan item", async () => {
    const quote = await previewPlanChange("org_a", "owner", "team");
    expect(quote.quote).toMatchObject({ amountDueCents: 200, targetPlan: "team", capacity: 5, taxCents: 0, discountCents: 0 });
    expect(provider.invoices.createPreview).toHaveBeenCalledWith(expect.objectContaining({ subscription: "sub_a", subscription_details: expect.objectContaining({ billing_cycle_anchor: "unchanged", proration_behavior: "always_invoice", items: [{ id: "si_a", price: "price_team", quantity: 1 }] }) }));
    expect(db.entitlement.update).not.toHaveBeenCalled();
  });
  it("includes an authoritative next-renewal total separate from the immediate invoice", async () => {
    provider.invoices.createPreview.mockResolvedValueOnce(invoice).mockResolvedValueOnce({ ...invoice, id: "upcoming_renewal", amount_due: 1539, subtotal: 1399, total: 1539, total_tax_amounts: [{ amount: 140 }] });
    const quote = await previewPlanChange("org_a", "owner", "team");
    expect(quote.quote).toMatchObject({ amountDueCents: 200, nextInvoiceTotalCents: 1539, nextInvoiceTaxCents: 140 });
  });
  it("rejects a downgrade with more than two occupied or reserved seats before touching provider", async () => {
    db.subscription.findUnique.mockResolvedValue({ ...local, selectedPlan: "team" }); provider.subscriptions.retrieve.mockResolvedValue({ ...remote, items: { data: [{ id: "si_a", price: team, quantity: 1 }] } });
    db.orgMember.count.mockResolvedValue(2); db.workspaceInvite.count.mockResolvedValue(1);
    await expect(previewPlanChange("org_a", "owner", "base")).rejects.toThrow("2 occupied or reserved");
    expect(provider.subscriptionSchedules.create).not.toHaveBeenCalled();
  });
  it("rejects expired approvals without any provider mutation", async () => {
    db.billingPlanChange.findFirst.mockResolvedValue({ id: "quote_a", orgId: "org_a", actorId: "owner", status: "quoted", expiresAt: new Date(0), payloadHash: "hash" });
    await expect(approvePlanChange("org_a", "owner", "quote_a", "hash")).rejects.toThrow("expired");
    expect(provider.subscriptions.update).not.toHaveBeenCalled();
  });
  it("rejects approval tampering and a materially changed provider preview", async () => {
    const quote = await previewPlanChange("org_a", "owner", "team"); db.billingPlanChange.findFirst.mockResolvedValue(quote);
    await expect(approvePlanChange("org_a", "owner", quote.id, "wrong")).rejects.toThrow("approval");
    provider.invoices.createPreview.mockResolvedValue({ ...invoice, amount_due: 201 });
    await expect(approvePlanChange("org_a", "owner", quote.id, quote.payloadHash)).rejects.toThrow("changed");
    expect(provider.subscriptions.update).not.toHaveBeenCalled();
  });
  it("uses payment-pending updates without granting Team before provider confirmation", async () => {
    const quote = await previewPlanChange("org_a", "owner", "team"); db.billingPlanChange.findFirst.mockResolvedValue(quote);
    provider.subscriptions.update.mockResolvedValue({ ...remote, pending_update: { expires_at: periodEnd }, latest_invoice: { id: "in_upgrade", paid: false, hosted_invoice_url: "https://invoice.stripe.com/pay/test" } });
    const result = await approvePlanChange("org_a", "owner", quote.id, quote.payloadHash);
    expect(provider.subscriptions.update).toHaveBeenCalledWith("sub_a", expect.objectContaining({ payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice", proration_date: quote.prorationDate, billing_cycle_anchor: "unchanged" }), { idempotencyKey: "plan-change:quote_a:upgrade" });
    expect(result.status).toBe("pending_payment"); expect(result.paymentUrl).toContain("invoice.stripe.com"); expect(db.entitlement.upsert).not.toHaveBeenCalled();
  });
  it("does not grant extra seats from an old or unknown provider price", async () => {
    await expect(reconcilePlanSubscription("org_a", { ...remote, items: { data: [{ id: "si_a", price: { ...team, id: "unapproved" }, quantity: 1 }] } } as never)).rejects.toThrow("approved");
    expect(db.entitlement.upsert).not.toHaveBeenCalled();
  });
  it("confirms Team immediately after a paid provider update without waiting for renewal", async () => {
    await reconcilePlanSubscription("org_a", { ...remote, items: { data: [{ id: "si_a", price: team, quantity: 1 }] } } as never);
    expect(db.entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ planKey: "team", seatLimit: 5, active: true }) }));
  });
  it("fails safely at renewal when unexpected capacity exceeds Base", async () => {
    db.subscription.findUnique.mockResolvedValue({ ...local, selectedPlan: "team", pendingPlan: "base" }); db.orgMember.count.mockResolvedValue(3);
    await expect(reconcilePlanSubscription("org_a", remote as never)).rejects.toThrow("capacity conflict");
    expect(db.entitlement.upsert).not.toHaveBeenCalled();
  });
  it("does not treat a still-unpaid invoice as completion even if provider price changed", async () => {
    await reconcilePlanSubscription("org_a", { ...remote, items: { data: [{ id: "si_a", price: team, quantity: 1 }] }, latest_invoice: { id: "in_open", paid: false, status: "open", amount_due: 200 } } as never);
    expect(db.entitlement.upsert).not.toHaveBeenCalled();
  });
  it("rechecks downgrade capacity transactionally immediately before provider scheduling", async () => {
    db.subscription.findUnique.mockResolvedValue({ ...local, selectedPlan: "team" });
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, items: { data: [{ id: "si_a", price: team, quantity: 1 }] } });
    const quote = await previewPlanChange("org_a", "owner", "base"); db.billingPlanChange.findFirst.mockResolvedValue(quote);
    db.orgMember.count.mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    await expect(approvePlanChange("org_a", "owner", quote.id, quote.payloadHash)).rejects.toThrow("2 occupied or reserved");
    expect(provider.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
  it("schedules two fixed-plan phases at renewal with no prorated refund", async () => {
    db.subscription.findUnique.mockResolvedValue({ ...local, selectedPlan: "team" });
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, items: { data: [{ id: "si_a", price: team, quantity: 1 }] } });
    const quote = await previewPlanChange("org_a", "owner", "base"); db.billingPlanChange.findFirst.mockResolvedValue(quote);
    provider.subscriptionSchedules.create.mockResolvedValue({ id: "sched_a" });
    provider.subscriptionSchedules.retrieve.mockResolvedValue({ id: "sched_a", status: "active", current_phase: { start_date: remote.current_period_start, end_date: periodEnd }, phases: [{ start_date: periodEnd, items: [{ price: "price_base" }] }] });
    const result = await approvePlanChange("org_a", "owner", quote.id, quote.payloadHash);
    expect(result.status).toBe("scheduled");
    expect(provider.subscriptionSchedules.update).toHaveBeenCalledWith("sched_a", expect.objectContaining({ end_behavior: "release", proration_behavior: "none", phases: [expect.objectContaining({ end_date: periodEnd, items: [{ price: "price_team", quantity: 1 }], proration_behavior: "none" }), expect.objectContaining({ start_date: periodEnd, items: [{ price: "price_base", quantity: 1 }], proration_behavior: "none" })] }), expect.anything());
    expect(db.entitlement.upsert).not.toHaveBeenCalled();
  });
  it("cancels only after the provider confirms release and Team remains selected", async () => {
    db.subscription.findUnique.mockResolvedValue({ ...local, selectedPlan: "team", pendingPlan: "base", stripeScheduleId: "sched_a", pendingPlanEffectiveAt: new Date(periodEnd * 1000) });
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, items: { data: [{ id: "si_a", price: team, quantity: 1 }] } });
    provider.subscriptionSchedules.retrieve.mockResolvedValueOnce({ id: "sched_a", status: "active" }).mockResolvedValueOnce({ id: "sched_a", status: "released" });
    const result = await cancelScheduledDowngrade("org_a", "owner");
    expect(result.status).toBe("cancelled");
    expect(provider.subscriptionSchedules.release).toHaveBeenCalledWith("sched_a", {}, { idempotencyKey: "plan-cancel:sched_a" });
    expect(db.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pendingPlan: null, stripeScheduleId: null }) }));
    expect(provider.subscriptions.update).not.toHaveBeenCalled();
  });
  it("returns completed approvals without creating another charge", async () => {
    const quote = await previewPlanChange("org_a", "owner", "team"); db.billingPlanChange.findFirst.mockResolvedValue({ ...quote, status: "complete" });
    expect((await approvePlanChange("org_a", "owner", quote.id, quote.payloadHash)).status).toBe("complete");
    expect(provider.subscriptions.update).not.toHaveBeenCalled();
  });
  it("checks the complete immutable approval payload", () => {
    expect(quoteHash({ subscription: "sub_a", targetPlan: "team", amountDue: 200 })).not.toBe(quoteHash({ subscription: "sub_b", targetPlan: "team", amountDue: 200 }));
  });
});
