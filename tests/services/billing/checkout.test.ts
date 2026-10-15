import { beforeEach, describe, expect, it, vi } from "vitest";
const { db, provider } = vi.hoisted(() => ({ db: { subscription: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() }, entitlement: { upsert: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }, provider: { prices: { retrieve: vi.fn() }, customers: { create: vi.fn() }, subscriptions: { list: vi.fn() }, billingPortal: { configurations: { retrieve: vi.fn() }, sessions: { create: vi.fn() } }, checkout: { sessions: { list: vi.fn(), create: vi.fn(), expire: vi.fn() } } } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/stripe", () => ({ stripe: provider, getPlanPriceId: (key: string) => key === "team" ? "price_team" : "price_base", getMonthlyPriceId: () => "price_base", getTrialFeePriceId: () => null }));
import { createCheckoutSession, createPortalSession } from "@/services/billing/checkout";
const price = { id: "price_team", active: true, currency: "usd", unit_amount: 1399, type: "recurring", billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1 } };
describe("explicit plan selection before first checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_a", status: "pending_payment" }); db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
    provider.prices.retrieve.mockResolvedValue(price); provider.checkout.sessions.list.mockResolvedValue({ data: [] }); provider.subscriptions.list.mockResolvedValue({ data: [] }); provider.checkout.sessions.create.mockResolvedValue({ id: "cs_a", url: "https://checkout.stripe.com/test" });
  });
  it("blocks a provider portal that could bypass approved plan changes", async () => {
    vi.stubEnv("STRIPE_PORTAL_CONFIGURATION_ID", "bpc_a");
    provider.billingPortal.configurations.retrieve.mockResolvedValue({ active: true, features: { subscription_update: { enabled: true } } });
    await expect(createPortalSession("org_a")).rejects.toThrow("subscription changes");
    expect(provider.billingPortal.sessions.create).not.toHaveBeenCalled();
  });
  it("carries Team choice, fixed total and capacity into checkout metadata", async () => {
    await createCheckoutSession("org_a", "owner", "owner@example.com", { plan: "team" });
    expect(provider.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: "price_team", quantity: 1 }], metadata: expect.objectContaining({ plan: "team", capacity: "5" }), subscription_data: expect.objectContaining({ trial_period_days: 7, metadata: expect.objectContaining({ plan: "team" }) }) }), expect.anything());
    expect(db.entitlement.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ active: false, seatLimit: 2 }) }));
  });
  it("rejects mismatched Team price before creating a customer or checkout", async () => {
    provider.prices.retrieve.mockResolvedValue({ ...price, unit_amount: 999 });
    await expect(createCheckoutSession("org_a", "owner", "owner@example.com", { plan: "team" })).rejects.toThrow("configured");
    expect(provider.customers.create).not.toHaveBeenCalled(); expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("refuses a new subscription when the workspace already has one", async () => {
    db.subscription.findUnique.mockResolvedValue({ stripeCustomerId: "cus_a", stripeSubscriptionId: "sub_existing", status: "active" });
    await expect(createCheckoutSession("org_a", "owner", "owner@example.com", { plan: "team" })).rejects.toThrow("already");
    expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("reuses the existing open same-plan checkout without creating duplicates", async () => {
    provider.checkout.sessions.list.mockResolvedValue({ data: [{ id: "cs_open", metadata: { orgId: "org_a", plan: "team" }, url: "https://checkout.stripe.com/open" }] });
    expect((await createCheckoutSession("org_a", "owner", "owner@example.com", { plan: "team" })).id).toBe("cs_open");
    expect(provider.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
