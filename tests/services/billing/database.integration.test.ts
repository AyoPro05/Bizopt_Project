// @vitest-environment node
import { randomUUID } from "node:crypto";
import { disposableTestDatabase } from "@/scripts/test-database-config.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const { provider } = vi.hoisted(() => ({ provider: { prices: { retrieve: vi.fn() }, customers: { create: vi.fn() }, subscriptions: { list: vi.fn(), retrieve: vi.fn() }, invoices: { list: vi.fn() }, checkout: { sessions: { list: vi.fn(), create: vi.fn(), expire: vi.fn() } } } }));
vi.mock("@/lib/stripe", () => ({ stripe: provider, getPlanPriceId: () => "price_fixture_base", getTrialFeePriceId: () => "price_fixture_intro" }));
import { db } from "@/lib/db";
import { createCheckoutSession } from "@/services/billing/checkout";
import { consentSnapshot } from "@/services/billing/commercial-consent";
import { processStripeEvent } from "@/services/billing/webhook-handler";
import { createRefund } from "@/services/billing/refunds";
const url = disposableTestDatabase(process.env.AUTOMATION_TEST_DATABASE_URL);
const enabled = !!url;
const suffix = randomUUID();
let orgId = "", userId = "";
let metadata: Record<string, string> = {};
const start = Math.floor(Date.now() / 1000), end = start + 7 * 86400;
const price = { id: "price_fixture_base", active: true, unit_amount: 999, currency: "usd", type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1 } };
const introPrice = { ...price, id: "price_fixture_intro", unit_amount: 99, type: "one_time", recurring: null };
const customer = `cus_fixture_${suffix}`, providerSub = `sub_fixture_${suffix}`;
const introductoryInvoice = () => ({ id: `in_fixture_${suffix}`, customer, subscription: providerSub, billing_reason: "subscription_create", paid: true, status: "paid", amount_paid: 99, amount_due: 99, currency: "usd", created: start, status_transitions: { paid_at: start }, lines: { has_more: false, data: [{ type: "invoiceitem", amount: 99, quantity: 1, price: introPrice, period: { start, end } }] } });
const subscription = () => ({ id: providerSub, customer, status: "trialing", metadata, items: { data: [{ id: `si_fixture_${suffix}`, price, quantity: 1 }] }, trial_start: start, trial_end: end, current_period_start: start, current_period_end: end, cancel_at_period_end: false, latest_invoice: introductoryInvoice() });
describe.skipIf(!enabled)("billing transactions against disposable PostgreSQL with mocked Stripe", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== url) throw new Error("Only the exact disposable database is allowed");
    vi.stubEnv("STRIPE_MONTHLY_PRICE_ID", price.id); vi.stubEnv("STRIPE_INTRODUCTORY_PRICE_ID", introPrice.id); vi.stubEnv("BILLING_AUTO_REFUND_POLICY_VERSION", "");
    userId = (await db.user.create({ data: { email: `billing-${suffix}@example.test`, emailVerified: new Date() } })).id;
    orgId = (await db.organization.create({ data: { name: "Billing fixture", slug: `billing-${suffix}`, members: { create: { userId, role: "owner" } }, subscription: { create: { stripeCustomerId: customer, status: "pending_payment" } } } })).id;
    provider.prices.retrieve.mockImplementation(async id => id === introPrice.id ? introPrice : price); provider.subscriptions.list.mockResolvedValue({ data: [], has_more: false }); provider.checkout.sessions.list.mockResolvedValue({ data: [], has_more: false });
    provider.checkout.sessions.create.mockImplementation(async params => { metadata = params.metadata; return { id: `cs_fixture_${suffix}`, url: "https://checkout.stripe.com/fixture" }; }); provider.subscriptions.retrieve.mockImplementation(async () => subscription()); provider.invoices.list.mockImplementation(async () => ({ data: [introductoryInvoice()], has_more: false }));
  });
  afterAll(async () => { if (orgId) await db.organization.delete({ where: { id: orgId } }); if (userId) await db.user.delete({ where: { id: userId } }); vi.unstubAllEnvs(); });
  it("persists commercial consent and pending access without fabricated dates", async () => {
    await createCheckoutSession(orgId, userId, `billing-${suffix}@example.test`, { plan: "base", consent: { accepted: true, ...consentSnapshot("base") } });
    const local = await db.subscription.findUniqueOrThrow({ where: { orgId } }); expect(local.trialStartAt).toBeNull(); expect(local.trialEndAt).toBeNull(); expect(local.checkoutConsentId).toBeTruthy(); expect(await db.commercialConsent.count({ where: { orgId } })).toBe(1); expect((await db.entitlement.findUniqueOrThrow({ where: { orgId } })).active).toBe(false);
  });
  it("commits paid evidence, entitlement and one semantic event together across duplicates", async () => {
    for (const type of ["invoice.paid", "invoice.payment_succeeded"]) await processStripeEvent({ id: `evt_${type}_${suffix}`, type, data: { object: introductoryInvoice() } } as never);
    const local = await db.subscription.findUniqueOrThrow({ where: { orgId } }); expect(local.introductoryInvoiceId).toBe(introductoryInvoice().id); expect(local.paidThrough?.getTime()).toBe(end * 1000); expect((await db.entitlement.findUniqueOrThrow({ where: { orgId } })).active).toBe(true);
    expect(await db.payment.count({ where: { orgId } })).toBe(1); expect(await db.outboxEvent.count({ where: { orgId, eventType: "billing.introductory_active" } })).toBe(1);
  });
  it("records refund review without changing paid entitlement or inventing an automatic policy", async () => {
    const payment = await db.payment.findFirstOrThrow({ where: { orgId, status: "succeeded" } }); const result = await createRefund(payment.id, "fixture support review"); expect(result.record.status).toBe("review_requested"); expect((await db.entitlement.findUniqueOrThrow({ where: { orgId } })).active).toBe(true);
  });
});
