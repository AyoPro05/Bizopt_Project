// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => {
  const delegate = () => ({ findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(), count: vi.fn(), groupBy: vi.fn() });
  return { db: { outboxEvent: delegate(), notification: delegate(), notificationAttempt: delegate(), notificationPreference: delegate(), emailSuppression: delegate(), providerWebhookEvent: delegate(), user: delegate(), identityToken: delegate(), orgMember: delegate(), subscription: delegate(), supportStaff: delegate(), dataExportJob: delegate(), payment: delegate(), refund: delegate(), $transaction: vi.fn() } };
});
vi.mock("@/lib/db", () => ({ db }));
import { runOutboxTick } from "@/services/automation/dispatcher";
import { runNotificationTick, runNotificationReconciliationTick } from "@/services/notifications/delivery";
import { DurableFakeEmailProvider, ProviderError, type EmailProvider } from "@/services/notifications/provider";
import { encryptPayload, decryptPayload, emailHash } from "@/services/notifications/crypto";

describe("durable notification delivery", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const event = { id: "event", userId: "user", orgId: null, eventType: "identity.password_changed", aggregateId: "user", dedupeKey: "changed:audit", correlationId: "correlation", payloadJson: {}, secretPayloadEnc: null, secretExpiresAt: null, recipientEmail: null, attemptCount: 0 };
  const job = { id: "mail", userId: "user", orgId: null, outboxEventId: "event", type: "identity.password_changed", category: "SECURITY", channel: "EMAIL", dedupeKey: "changed:audit:EMAIL", dataJson: {}, secretPayloadEnc: null, secretExpiresAt: null, providerPayloadEnc: null, providerPayloadExpiresAt: null, recipientEmail: null, firstAttemptAt: null, attemptCount: 0, status: "queued", event };
  const provider = { name: "fixture", send: vi.fn(), get: vi.fn() } satisfies EmailProvider;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("APP_URL", "https://app.example.test"); vi.stubEnv("NOTIFICATION_PAYLOAD_KEY", Buffer.alloc(32, 4).toString("base64")); vi.stubEnv("EMAIL_FROM", "mail@example.test"); vi.stubEnv("EMAIL_REPLY_TO", "support@example.test"); vi.stubEnv("SUPPORT_URL", "https://app.example.test/help"); vi.stubEnv("EMAIL_PROVIDER", "fake");
    db.$transaction.mockImplementation(async (fn) => fn(db));
    db.outboxEvent.findFirst.mockResolvedValue(event); db.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    db.notificationPreference.findMany.mockResolvedValue([]); db.notification.createMany.mockResolvedValue({ count: 2 });
    db.notification.findFirst.mockResolvedValue(job); db.notification.updateMany.mockResolvedValue({ count: 1 });
    db.user.findUnique.mockResolvedValue({ email: "person@example.test" }); db.emailSuppression.findUnique.mockResolvedValue(null);
    db.notificationAttempt.create.mockResolvedValue({}); provider.send.mockResolvedValue({ messageId: "provider-mail", acceptedAt: now });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("atomically dispatches separate channel rows with stable keys and no in-app secrets", async () => {
    await runOutboxTick({ now });
    const data = db.notification.createMany.mock.calls[0][0].data;
    expect(data.map((row: { dedupeKey: string }) => row.dedupeKey)).toEqual(["changed:audit:EMAIL", "changed:audit:IN_APP"]);
    expect(data.find((row: { channel: string }) => row.channel === "IN_APP")).toMatchObject({ status: "available", secretPayloadEnc: null, recipientEmail: null });
    expect(db.outboxEvent.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ processingStatus: "processed", secretPayloadEnc: null });
  });
  it("supports targeted durable job checks without reading unrelated customer jobs", async () => {
    await runOutboxTick({ now, eventId: "event" });
    await runNotificationTick({ now, provider, notificationId: "mail" });
    expect(db.outboxEvent.findFirst.mock.calls[0][0].where.id).toBe("event");
    expect(db.notification.findFirst.mock.calls[0][0].where.id).toBe("mail");
  });
  it("does not announce an expired or inaccessible data export", async () => {
    const exportEvent = { ...event, orgId: "org", aggregateId: "export-id", eventType: "account.export_ready" };
    db.outboxEvent.findFirst.mockResolvedValue(exportEvent); db.dataExportJob.findFirst.mockResolvedValue(null);
    await runOutboxTick({ now }); expect(db.notification.createMany).not.toHaveBeenCalled();
    expect(db.dataExportJob.findFirst.mock.calls[0][0].where).toMatchObject({ id: "export-id", orgId: "org", userId: "user", status: "ready", expiresAt: { gt: now } });
  });
  it("does not dispatch or send after another worker owns the lease", async () => {
    db.outboxEvent.updateMany.mockResolvedValue({ count: 0 }); db.notification.updateMany.mockResolvedValue({ count: 0 });
    expect(await runOutboxTick({ now })).toBe(false); expect(await runNotificationTick({ now, provider })).toBe(false);
    expect(provider.send).not.toHaveBeenCalled(); expect(db.notification.createMany).not.toHaveBeenCalled();
  });
  it("rechecks owner authority and canceled introductory reminders at dispatch and send", async () => {
    const reminder = { ...event, orgId: "org", aggregateId: "sub", eventType: "billing.introductory_ending", payloadJson: { periodEnd: new Date(now.getTime() + 86400_000).toISOString() } };
    db.orgMember.findUnique.mockResolvedValue({ role: "owner" });
    db.subscription.findUnique.mockResolvedValue({ stripeSubscriptionId: "sub", introductoryPaidAt: now, trialEndAt: new Date(now.getTime() + 86400_000), cancelAtPeriodEnd: true, status: "trialing" });
    db.outboxEvent.findFirst.mockResolvedValue(reminder); await runOutboxTick({ now });
    expect(db.notification.createMany).not.toHaveBeenCalled();
    db.notification.findFirst.mockResolvedValue({ ...job, orgId: "org", type: "billing.introductory_ending", event: reminder });
    await runNotificationTick({ now, provider }); expect(provider.send).not.toHaveBeenCalled();
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "canceled", failureCode: "event_superseded" });
    db.orgMember.findUnique.mockResolvedValue(null); db.outboxEvent.findFirst.mockResolvedValue({ ...reminder, eventType: "billing.monthly_active" });
    await runOutboxTick({ now }); expect(db.notification.createMany).not.toHaveBeenCalled();
  });
  it("cancels stale payment and refund notices after recovery and removed operational owners", async () => {
    db.orgMember.findUnique.mockResolvedValue({ role: "owner" });
    const failure = { ...event, orgId: "org", eventType: "billing.payment_failed", payloadJson: { invoiceId: "invoice" } };
    db.payment.findFirst.mockResolvedValue({ status: "succeeded" }); db.outboxEvent.findFirst.mockResolvedValue(failure);
    await runOutboxTick({ now }); expect(db.notification.createMany).not.toHaveBeenCalled();
    db.refund.findFirst.mockResolvedValue({ status: "refunded" }); db.outboxEvent.findFirst.mockResolvedValue({ ...failure, eventType: "billing.refund_pending", payloadJson: { refundReference: "refund" } });
    await runOutboxTick({ now }); expect(db.notification.createMany).not.toHaveBeenCalled();
    db.orgMember.findUnique.mockResolvedValue(null); db.outboxEvent.findFirst.mockResolvedValue({ ...failure, eventType: "publishing.failed", payloadJson: {} });
    db.notificationPreference.findMany.mockResolvedValue([{ channel: "EMAIL", category: "OPERATIONAL", enabled: true }]);
    await runOutboxTick({ now }); expect(db.notification.createMany).not.toHaveBeenCalled();
  });
  it("freezes the encrypted provider request before sending and records acceptance separately from delivery", async () => {
    await runNotificationTick({ now, provider });
    const frozen = db.notification.updateMany.mock.calls.find(([arg]) => arg.data.providerPayloadEnc)?.[0].data.providerPayloadEnc;
    expect(decryptPayload(frozen, "provider:mail")).toMatchObject({ to: "person@example.test" });
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: "person@example.test" }), "bizopt-mail");
    expect(db.notificationAttempt.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outcome: "started", attemptNumber: 1 }) }));
    expect(db.notificationAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outcome: "accepted" }) }));
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "accepted", providerMessageId: "provider-mail" });
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).not.toHaveProperty("deliveredAt");
  });
  it("reuses the exact frozen request after a crash and stops before provider idempotency expires", async () => {
    const frozen = { from: "old@example.test", replyTo: "support@example.test", to: "person@example.test", subject: "Original", html: "<p>Original</p>", text: "Original" };
    db.notification.findFirst.mockResolvedValue({ ...job, firstAttemptAt: new Date(now.getTime() - 1000), attemptCount: 1, providerPayloadEnc: encryptPayload(frozen, "provider:mail") });
    await runNotificationTick({ now, provider }); expect(provider.send.mock.calls[0][0]).toEqual(frozen);
    provider.send.mockClear(); db.notification.findFirst.mockResolvedValue({ ...job, firstAttemptAt: new Date(now.getTime() - 23 * 3600000), attemptCount: 2, providerPayloadEnc: encryptPayload(frozen, "provider:mail") });
    await runNotificationTick({ now, provider }); expect(provider.send).not.toHaveBeenCalled();
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "reconciliation_required", failureCode: "idempotency_window" });
  });
  it("suppresses known hard bounces without bypassing essential category protection", async () => {
    db.emailSuppression.findUnique.mockResolvedValue({ reason: "hard_bounce" });
    await runNotificationTick({ now, provider }); expect(provider.send).not.toHaveBeenCalled();
    expect(db.emailSuppression.findUnique).toHaveBeenCalledWith({ where: { emailHash: emailHash("person@example.test") } });
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "suppressed" });
  });
  it("bounds failures and never persists provider exception text", async () => {
    provider.send.mockRejectedValue(new ProviderError("ambiguous", "provider_timeout"));
    db.notification.findFirst.mockResolvedValue({ ...job, attemptCount: 7 });
    await runNotificationTick({ now, provider });
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "reconciliation_required", failureCode: "provider_timeout" });
    expect(JSON.stringify(db.notification.updateMany.mock.calls)).not.toContain("raw-provider");
  });
  it("rejects obsolete proofs before contacting provider and clears encrypted proof material", async () => {
    db.notification.findFirst.mockResolvedValue({ ...job, type: "identity.password_reset_requested", secretPayloadEnc: encryptPayload({ id: "old", token: "secret" }, "event:changed:audit"), secretExpiresAt: new Date(now.getTime() + 60000) });
    db.identityToken.findUnique.mockResolvedValue({ consumedAt: now, expiresAt: new Date(now.getTime() + 60000) });
    await runNotificationTick({ now, provider }); expect(provider.send).not.toHaveBeenCalled();
    expect(db.notification.updateMany.mock.calls.at(-1)?.[0].data).toMatchObject({ status: "canceled", secretPayloadEnc: null, providerPayloadEnc: null });
  });
  it("purges expired ciphertext on a reconciliation tick without creating a new send", async () => {
    db.notification.findMany.mockResolvedValue([]); db.providerWebhookEvent.findMany.mockResolvedValue([]);
    await runNotificationReconciliationTick({ now, provider });
    expect(db.notification.updateMany.mock.calls.some(([arg]) => arg.data.providerPayloadEnc === null && arg.where.providerPayloadExpiresAt)).toBe(true);
    expect(db.outboxEvent.updateMany.mock.calls.some(([arg]) => arg.data.secretPayloadEnc === null && arg.where.secretExpiresAt)).toBe(true);
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("fake provider accepts only .test recipients and persists stable provider metadata", async () => {
    const fake = new DurableFakeEmailProvider();
    const message = { to: "person@example.test", from: "mail@example.test", replyTo: "support@example.test", subject: "Hello", html: "<p>Hello</p>", text: "Hello" };
    db.providerWebhookEvent.upsert.mockImplementation(({ create }) => Promise.resolve({ ...create, receivedAt: now }));
    expect((await fake.send(message, "stable")).messageId).toMatch(/^fake_/);
    expect(JSON.stringify(db.providerWebhookEvent.upsert.mock.calls)).not.toContain("person@example.test");
    const expiry = new Date(Date.now() + 60000).toISOString();
    await fake.send({ ...message, retentionExpiresAt: expiry }, "sensitive-fixture");
    expect(db.providerWebhookEvent.upsert.mock.calls.at(-1)?.[0].create.availableAt).toEqual(new Date(expiry));
    await expect(fake.send({ ...message, to: "person@example.com" }, "other")).rejects.toThrow();
    vi.stubEnv("NODE_ENV", "production"); await expect(fake.send(message, "stable")).rejects.toThrow();
  });
});
