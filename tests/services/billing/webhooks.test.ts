import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, provider, sent, emitEvent } = vi.hoisted(() => {
  const sent = new Map<string, unknown>();
  return { sent, emitEvent: vi.fn(async (_tx, event) => { if (!sent.has(event.dedupeKey)) sent.set(event.dedupeKey, event); }), db: { subscription: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() }, commercialConsent: { findFirst: vi.fn() }, payment: { upsert: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, orgMember: { findMany: vi.fn(), count: vi.fn() }, workspaceInvite: { count: vi.fn() }, billingPlanChange: { updateMany: vi.fn() }, entitlement: { upsert: vi.fn(), updateMany: vi.fn() }, auditLog: { create: vi.fn() }, supportStaff: { findMany: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn() }, provider: { subscriptions: { retrieve: vi.fn() }, invoices: { list: vi.fn(), retrieve: vi.fn(), listLineItems: vi.fn() }, refunds: { retrieve: vi.fn() }, disputes: { retrieve: vi.fn() } } };
});
vi.mock("@/lib/db", () => ({ db })); vi.mock("@/lib/stripe", () => ({ stripe: provider }));
vi.mock("@/services/automation/events", () => ({ emitEvent }));
import { processStripeEvent } from "@/services/billing/webhook-handler";
const start = Math.floor(Date.now() / 1000) - 100;
const end = start + 7 * 86400;
const price = { id: "price_base", active: true, unit_amount: 999, currency: "usd", type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1 } };
const consent = { id: "consent_a", checkoutIntentId: "intent_a", orgId: "org_a", userId: "owner", planKey: "base", introductoryAmountMinor: 99, introductoryDurationDays: 7, recurringAmountMinor: 999, currency: "usd" };
const remote = { id: "sub_a", customer: "cus_a", status: "trialing", metadata: { orgId: "org_a", userId: "owner", consentId: "consent_a", checkoutIntentId: "intent_a" }, items: { data: [{ id: "si_a", price, quantity: 1 }] }, trial_start: start, trial_end: end, current_period_start: start, current_period_end: end, cancel_at_period_end: false, latest_invoice: null };
const intro = { id: "in_intro", customer: "cus_a", subscription: "sub_a", billing_reason: "subscription_create", paid: true, status: "paid", amount_paid: 99, amount_due: 99, currency: "usd", created: start, status_transitions: { paid_at: start }, lines: { has_more: false, data: [{ amount: 99, quantity: 1, price: { ...price, id: "price_intro", unit_amount: 99, type: "one_time", recurring: null }, period: { start, end } }] } };
const monthly = { ...intro, id: "in_month", billing_reason: "subscription_cycle", amount_paid: 999, amount_due: 999, lines: { has_more: false, data: [{ type: "subscription", amount: 999, quantity: 1, subscription: "sub_a", price, period: { start, end: end + 23 * 86400 } }] } };
let local: Record<string, unknown>;
const event = (type: string, object: unknown = remote) => ({ id: `evt_${type}`, type, data: { object } }) as never;
const notices = () => [...sent.values()] as { eventType: string; dedupeKey: string; payload: Record<string, unknown> }[];
describe("transactional current-provider billing lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks(); sent.clear(); vi.stubEnv("STRIPE_PRICE_ID", "price_base"); vi.stubEnv("STRIPE_TEAM_PRICE_ID", "price_team"); vi.stubEnv("STRIPE_INTRODUCTORY_PRICE_ID", "price_intro");
    local = { id: "local", orgId: "org_a", stripeSubscriptionId: "sub_a", stripeCustomerId: "cus_a", checkoutConsentId: "consent_a", selectedPlan: "base", status: "pending_payment", paidThrough: null, introductoryPaidAt: null, firstRecurringInvoiceId: null };
    db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db)); db.subscription.findUnique.mockImplementation(async () => ({ ...local })); db.subscription.findFirst.mockImplementation(async () => ({ ...local }));
    db.subscription.upsert.mockImplementation(async ({ update }) => { Object.assign(local, update); return { ...local }; }); db.subscription.update.mockImplementation(async ({ data }) => { Object.assign(local, data); return { ...local }; });
    db.commercialConsent.findFirst.mockResolvedValue(consent); db.orgMember.findMany.mockResolvedValue([{ userId: "owner", user: { email: "owner@example.com" } }]); db.orgMember.count.mockResolvedValue(1); db.workspaceInvite.count.mockResolvedValue(0);
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, latest_invoice: intro }); provider.invoices.list.mockResolvedValue({ data: [intro], has_more: false });
  });
  it("routes genuine disputes only to active internal support administrators", async () => {
    provider.disputes.retrieve.mockResolvedValue({ id: "dp_a", payment_intent: "pi_a", status: "needs_response", amount: 999, currency: "usd" }); db.payment.findFirst.mockResolvedValue({ id: "payment_a", orgId: "org_a" }); db.supportStaff.findMany.mockResolvedValue([{ userId: "staff_admin" }]);
    await processStripeEvent(event("charge.dispute.created", { id: "dp_a" }));
    expect(emitEvent).toHaveBeenCalledWith(db, expect.objectContaining({ userId: "staff_admin", eventType: "billing.dispute" })); expect(emitEvent).not.toHaveBeenCalledWith(db, expect.objectContaining({ userId: "owner" })); expect(db.entitlement.updateMany).not.toHaveBeenCalled();
  });
  it("ignores disputes without a related payment rather than selecting an arbitrary tenant", async () => {
    provider.disputes.retrieve.mockResolvedValue({ id: "dp_a", payment_intent: null, status: "needs_response" });
    await processStripeEvent(event("charge.dispute.created", { id: "dp_a" })); expect(db.payment.findFirst).not.toHaveBeenCalled(); expect(emitEvent).not.toHaveBeenCalled();
  });
  it("activates paid introductory access once across different provider events", async () => {
    await processStripeEvent(event("invoice.paid", intro)); await processStripeEvent(event("checkout.session.async_payment_succeeded", { customer: "cus_a", subscription: "sub_a" }));
    expect(local.introductoryInvoiceId).toBe("in_intro");
    expect(db.entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ active: true, userFacingState: "trialing" }) }));
    expect(notices().filter(row => row.eventType === "billing.introductory_active")).toHaveLength(1);
  });
  it("ignores superseded canceled subscription events while a new checkout is pending", async () => {
    local.stripeSubscriptionId = null; local.checkoutConsentId = "consent_new";
    await processStripeEvent(event("customer.subscription.updated"));
    expect(db.subscription.upsert).not.toHaveBeenCalled(); expect(notices()).toHaveLength(0);
  });
  it("does not activate unpaid or zero-value introductory invoices", async () => {
    provider.invoices.list.mockResolvedValue({ data: [{ ...intro, amount_paid: 0, amount_due: 0 }], has_more: false });
    await processStripeEvent(event("customer.subscription.created"));
    expect(db.entitlement.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ active: true }) })); expect(notices()).toHaveLength(0);
  });
  it("does not trust a checkout redirect, an unrelated intent or forged tenant metadata", async () => {
    await processStripeEvent(event("payment_intent.succeeded", { id: "pi_unrelated", customer: "cus_a", metadata: { orgId: "org_a" } })); expect(provider.subscriptions.retrieve).not.toHaveBeenCalled();
    db.subscription.findUnique.mockResolvedValue({ ...local, orgId: "org_b", stripeCustomerId: "cus_b" }); db.subscription.findFirst.mockResolvedValue(null);
    await processStripeEvent(event("customer.subscription.updated", { ...remote, metadata: { orgId: "org_b" } })); expect(notices()).toHaveLength(0);
  });
  it("sends first recurring activation once and later invoice renewal", async () => {
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "active", latest_invoice: monthly, current_period_end: end + 23 * 86400 }); provider.invoices.list.mockResolvedValue({ data: [monthly, intro], has_more: false });
    await processStripeEvent(event("invoice.paid", monthly)); await processStripeEvent(event("invoice.payment_succeeded", monthly));
    expect(notices().filter(row => row.eventType === "billing.monthly_active")).toHaveLength(1); expect(notices().filter(row => row.eventType === "billing.renewed")).toHaveLength(0);
    const renewal = { ...monthly, id: "in_renew", created: end, lines: { has_more: false, data: [{ ...monthly.lines.data[0], period: { start: end + 23 * 86400, end: end + 53 * 86400 } }] } };
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "active", latest_invoice: renewal, current_period_end: end + 53 * 86400 }); provider.invoices.list.mockResolvedValue({ data: [renewal, monthly, intro], has_more: false });
    await processStripeEvent(event("invoice.paid", renewal)); expect(notices().filter(row => row.eventType === "billing.renewed")).toHaveLength(1);
  });
  it("stale failure event cannot roll back a fetched paid invoice or emit failure", async () => {
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "active", latest_invoice: monthly, current_period_end: end + 23 * 86400 }); provider.invoices.list.mockResolvedValue({ data: [monthly, intro], has_more: false });
    await processStripeEvent(event("invoice.payment_failed", { ...monthly, paid: false, status: "open", amount_paid: 0 }));
    expect(db.payment.upsert).not.toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "failed" }) })); expect(notices().some(row => row.eventType === "billing.payment_failed")).toBe(false);
  });
  it("failure preserves valid paid access, anchors grace and recovery excludes activation", async () => {
    local.status = "active"; local.paidThrough = new Date(end * 1000); local.introductoryPaidAt = new Date(start * 1000);
    const failed = { ...monthly, paid: false, status: "open", amount_paid: 0, attempt_count: 1, payment_intent: { id: "pi_a", status: "requires_payment_method" } };
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "past_due", latest_invoice: failed }); provider.invoices.list.mockResolvedValue({ data: [failed, intro], has_more: false });
    await processStripeEvent(event("invoice.payment_failed", failed)); const grace = local.graceUntil; await processStripeEvent(event("invoice.payment_failed", failed)); expect(local.graceUntil).toEqual(grace); expect(notices().filter(row => row.eventType === "billing.payment_failed")).toHaveLength(1);
    provider.subscriptions.retrieve.mockResolvedValue({ ...remote, status: "active", latest_invoice: monthly }); provider.invoices.list.mockResolvedValue({ data: [monthly, intro], has_more: false }); await processStripeEvent(event("invoice.paid", monthly));
    expect(notices().filter(row => row.eventType === "billing.payment_recovered")).toHaveLength(1); expect(notices().some(row => row.eventType === "billing.monthly_active")).toBe(false);
  });
  it("rechecks current cancellation before reminders and emits cancellation/resume transitions", async () => {
    local.status = "trialing"; local.introductoryPaidAt = new Date(start * 1000); local.introductoryInvoiceId = "in_intro";
    const ending = { ...remote, trial_end: Math.floor(Date.now() / 1000) + 86400, cancel_at_period_end: true };
    provider.subscriptions.retrieve.mockResolvedValue(ending); await processStripeEvent(event("customer.subscription.trial_will_end", remote));
    expect(notices().some(row => row.eventType === "billing.introductory_ending")).toBe(false); expect(notices().some(row => row.eventType === "billing.cancellation_scheduled")).toBe(true);
    provider.subscriptions.retrieve.mockResolvedValue({ ...ending, cancel_at_period_end: false }); await processStripeEvent(event("customer.subscription.updated"));
    expect(notices().some(row => row.eventType === "billing.resumed")).toBe(true); expect(notices().filter(row => row.eventType === "billing.introductory_ending")).toHaveLength(1);
  });
});
