// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { providerWebhookEvent: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() }, notification: { findUnique: vi.fn(), updateMany: vi.fn() }, emailSuppression: { upsert: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
import { acceptEmailWebhook, applyProviderStatus, processEmailWebhookInbox } from "@/services/notifications/webhooks";
import { emailHash } from "@/services/notifications/crypto";

describe("verified private email delivery inbox", () => {
  const key = Buffer.alloc(32, 8);
  const now = new Date();
  const payload = JSON.stringify({ type: "email.bounced", created_at: now.toISOString(), data: { email_id: "provider-mail", from: "sender@example.test", to: ["person@example.test"], subject: "private subject", bounce: { type: "Permanent", subType: "General", message: "raw-provider-detail" } } });
  function headers(raw = payload) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Headers({ "svix-id": "signed-id", "svix-timestamp": timestamp, "svix-signature": `v1,${createHmac("sha256", key).update(`signed-id.${timestamp}.${raw}`).digest("base64")}` });
  }
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("EMAIL_WEBHOOK_SECRET", `whsec_${key.toString("base64")}`);
    db.providerWebhookEvent.upsert.mockResolvedValue({ id: "receipt" }); db.providerWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation(async fn => fn(db)); db.notification.updateMany.mockResolvedValue({ count: 1 });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("verifies the exact raw payload using the installed SDK before durable unique acceptance", async () => {
    await expect(acceptEmailWebhook(payload, headers())).resolves.toEqual({ accepted: true });
    expect(db.providerWebhookEvent.upsert.mock.calls[0][0].where).toEqual({ provider_providerEventId: { provider: "resend", providerEventId: "signed-id" } });
    const stored = JSON.stringify(db.providerWebhookEvent.upsert.mock.calls);
    expect(stored).toContain(emailHash("person@example.test"));
    expect(stored).not.toMatch(/person@example.test|private subject|raw-provider-detail/);
    db.providerWebhookEvent.upsert.mockClear();
    await expect(acceptEmailWebhook(payload + " ", headers())).rejects.toThrow();
    expect(db.providerWebhookEvent.upsert).not.toHaveBeenCalled();
  });
  it("deduplicates without replaying processed effects and suppresses hard bounces durably", async () => {
    db.providerWebhookEvent.findMany.mockResolvedValue([{ id: "receipt", receivedAt: now, payloadJson: { messageId: "provider-mail", status: "bounced", occurredAt: now.toISOString(), recipientHashes: [emailHash("person@example.test")], suppressReason: "hard_bounce" } }]);
    db.notification.findUnique.mockResolvedValue({ id: "notification", status: "accepted", providerStatusAt: null });
    expect(await processEmailWebhookInbox(now)).toBe(1);
    expect(db.emailSuppression.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { emailHash: emailHash("person@example.test") }, create: expect.objectContaining({ reason: "hard_bounce" }) }));
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("bounced");
    expect(db.providerWebhookEvent.updateMany.mock.calls.at(-1)?.[0].data.status).toBe("processed");
  });
  it("does not regress delivered to accepted, or complaint to delivered, or event time backwards", async () => {
    db.notification.findUnique.mockResolvedValue({ id: "notification", status: "delivered", providerStatusAt: now });
    await applyProviderStatus(db as never, "provider-mail", "sent", new Date(now.getTime() + 1000));
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    db.notification.findUnique.mockResolvedValue({ id: "notification", status: "complained", providerStatusAt: now });
    await applyProviderStatus(db as never, "provider-mail", "delivered", new Date(now.getTime() + 1000));
    expect(db.notification.updateMany).not.toHaveBeenCalled();
    db.notification.findUnique.mockResolvedValue({ id: "notification", status: "accepted", providerStatusAt: now });
    await applyProviderStatus(db as never, "provider-mail", "delivered", new Date(now.getTime() - 1000));
    expect(db.notification.updateMany).not.toHaveBeenCalled();
  });
  it("retains early delivery receipts for later correlation instead of losing accepted-before-write races", async () => {
    db.providerWebhookEvent.findMany.mockResolvedValue([{ id: "receipt", receivedAt: now, payloadJson: { messageId: "early", status: "delivered", occurredAt: now.toISOString(), recipientHashes: [] } }]);
    db.notification.findUnique.mockResolvedValue(null);
    await processEmailWebhookInbox(now);
    expect(db.providerWebhookEvent.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "pending" });
    expect(db.providerWebhookEvent.updateMany.mock.calls.at(-1)?.[0].data.processedAt).toBeNull();
  });
});
