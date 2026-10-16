import { beforeEach, expect, it, vi } from "vitest";
const { db, constructEvent, processEvent } = vi.hoisted(() => ({ db: { stripeEvent: { create: vi.fn() } }, constructEvent: vi.fn(), processEvent: vi.fn() }));
vi.mock("@/lib/db", () => ({ db })); vi.mock("@/lib/stripe", () => ({ stripe: { webhooks: { constructEvent } } })); vi.mock("@/services/billing/webhook-inbox", () => ({ processStoredStripeEvent: processEvent }));
import { POST } from "@/app/api/stripe/webhook/route";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture"); constructEvent.mockReturnValue({ id: "evt_fixture", type: "invoice.paid", livemode: false, data: { object: {} } }); });
it("durably accepts verified raw payload without processing inline", async () => {
  const response = await POST(new Request("https://app.example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture_signature" }, body: '{ "fixture": true }' }));
  expect(response.status).toBe(200); expect(constructEvent).toHaveBeenCalledWith('{ "fixture": true }', "fixture_signature", "whsec_fixture"); expect(db.stripeEvent.create).toHaveBeenCalled(); expect(processEvent).not.toHaveBeenCalled();
});
it("does not acknowledge an event that could not be durably stored", async () => {
  db.stripeEvent.create.mockRejectedValueOnce(new Error("database unavailable"));
  const response = await POST(new Request("https://app.example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture_signature" }, body: "{}" })); expect(response.status).toBe(503);
});
it("rejects test events on live-key environments even if the signature verifies", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture_not_a_real_key");
  const response = await POST(new Request("https://app.example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture_signature" }, body: "{}" })); expect(response.status).toBe(400); expect(db.stripeEvent.create).not.toHaveBeenCalled();
  vi.stubEnv("STRIPE_SECRET_KEY", "");
});
