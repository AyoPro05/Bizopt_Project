import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, provider, feeId } = vi.hoisted(() => ({ db: { user: { findUnique: vi.fn() }, subscription: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() }, commercialConsent: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() }, entitlement: { upsert: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }, feeId: vi.fn(), provider: { prices: { retrieve: vi.fn() }, customers: { create: vi.fn() }, subscriptions: { list: vi.fn() }, billingPortal: { configurations: { retrieve: vi.fn() }, sessions: { create: vi.fn() } }, checkout: { sessions: { list: vi.fn(), create: vi.fn(), expire: vi.fn() } } } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/stripe", () => ({ stripe: provider, getPlanPriceId: (key: string) => key === "team" ? "price_team" : "price_base", getTrialFeePriceId: feeId }));
import { createCheckoutSession, createPortalSession } from "@/services/billing/checkout";
const price = { id: "price_team", active: true, currency: "usd", unit_amount: 1399, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1 } };
const consent = { accepted: true as const, offerVersion: "2026-10-15", termsVersion: "2026-10-15", renewalDisclosureVersion: "2026-10-15", planKey: "team" as const, introductoryAmountMinor: 99, introductoryDurationDays: 7, recurringAmountMinor: 1399, currency: "usd" };
const options = { plan: "team" as const, consent };
describe("explicit consent before paid introductory checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.user.findUnique.mockResolvedValue({ email: "owner@example.com", emailVerified: new Date() }); db.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_a", status: "pending_payment" }); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
    feeId.mockReturnValue("price_intro"); provider.prices.retrieve.mockImplementation((id: string) => Promise.resolve(id === "price_intro" ? { ...price, id, unit_amount: 99, type: "one_time", recurring: null } : price));
    provider.checkout.sessions.list.mockResolvedValue({ data: [] }); provider.subscriptions.list.mockResolvedValue({ data: [] }); provider.checkout.sessions.create.mockResolvedValue({ id: "cs_a", url: "https://checkout.stripe.com/test" }); db.commercialConsent.create.mockImplementation(({ data }) => ({ id: "consent_a", ...data }));
  });
  it("blocks a provider portal that could bypass approved plan changes", async () => {
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_a"); provider.billingPortal.configurations.retrieve.mockResolvedValue({ active: true, features: { subscription_update: { enabled: true } } });
    await expect(createPortalSession("org_a")).rejects.toThrow("subscription changes"); expect(provider.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
  it("requires mandatory introductory fee plus selected fixed monthly price and reusable card", async () => {
    await createCheckoutSession("org_a", "owner", "owner@example.com", options);
    expect(provider.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription", line_items: [{ price: "price_intro", quantity: 1 }, { price: "price_team", quantity: 1 }], payment_method_collection: "always", payment_method_types: ["card"], metadata: expect.objectContaining({ plan: "team", capacity: "5", consentId: "consent_a" }), subscription_data: expect.objectContaining({ trial_period_days: 7 }) }), expect.anything());
    expect(db.commercialConsent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: "org_a", userId: "owner", ...Object.fromEntries(Object.entries(consent).filter(([key]) => key !== "accepted")) }) });
    expect(db.subscription.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ trialStartAt: expect.anything() }) }));
    expect(db.entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ active: false, seatLimit: 2 }) }));
  });
  it("rejects missing, false or changed commercial consent before a provider call", async () => {
    for (const invalid of [undefined, { ...consent, accepted: false }, { ...consent, recurringAmountMinor: 999 }, { ...consent, termsVersion: "old" }]) await expect(createCheckoutSession("org_a", "owner", "owner@example.com", { plan: "team", consent: invalid } as never)).rejects.toThrow(/consent|terms/i);
    expect(provider.prices.retrieve).not.toHaveBeenCalled(); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("requires verified email even for service callers", async () => {
    db.user.findUnique.mockResolvedValue({ emailVerified: null });
    await expect(createCheckoutSession("org_a", "owner", "owner@example.com", options)).rejects.toMatchObject({ status: 403 }); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("never silently offers a free period if introductory configuration is missing", async () => {
    feeId.mockReturnValue(null);
    await expect(createCheckoutSession("org_a", "owner", "owner@example.com", options)).rejects.toThrow(/introductory/i); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("rejects mismatched Team price before creating checkout", async () => {
    provider.prices.retrieve.mockResolvedValue({ ...price, unit_amount: 999 });
    await expect(createCheckoutSession("org_a", "owner", "owner@example.com", options)).rejects.toThrow("configured"); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("refuses new subscriptions when workspace already has one", async () => {
    db.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_existing", status: "active" });
    await expect(createCheckoutSession("org_a", "owner", "owner@example.com", options)).rejects.toThrow("already"); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("reuses only an existing checkout bound to this actor and accepted consent", async () => {
    provider.checkout.sessions.list.mockResolvedValue({ data: [{ id: "cs_open", metadata: { orgId: "org_a", plan: "team", consentId: "consent_old" } }] });
    db.commercialConsent.findFirst.mockResolvedValue({ id: "consent_old", ...consent, orgId: "org_a", userId: "owner", providerCheckoutId: "cs_open" });
    expect((await createCheckoutSession("org_a", "owner", "owner@example.com", options)).id).toBe("cs_open"); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
