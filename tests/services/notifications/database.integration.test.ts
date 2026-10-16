// @vitest-environment node
import { createHmac, randomUUID } from "node:crypto";
import { disposableTestDatabase } from "@/scripts/test-database-config.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { emitEvent } from "@/services/automation/events";
import { runOutboxTick } from "@/services/automation/dispatcher";
import { runNotificationTick, runNotificationReconciliationTick } from "@/services/notifications/delivery";
import { DurableFakeEmailProvider, getFakeMailPreview, ProviderError } from "@/services/notifications/provider";
import { acceptEmailWebhook, processEmailWebhookInbox } from "@/services/notifications/webhooks";
import { emailHash, encryptPayload } from "@/services/notifications/crypto";

// Never load app .env or use a live URL; the fixture DB must be explicitly selected.
const testUrl = disposableTestDatabase(process.env.AUTOMATION_TEST_DATABASE_URL);
const enabled = !!testUrl;
const fixtureDb = new PrismaClient({ datasourceUrl: enabled ? testUrl : "postgresql://disabled@127.0.0.1:1/disabled" });
const suffix = randomUUID();
const fakeIds: string[] = [];
const webhookIds: string[] = [];
let userId = "";
let orgId = "";
const fake = new DurableFakeEmailProvider();

describe.skipIf(!enabled)("notification PostgreSQL delivery integration", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== testUrl) throw new Error("DATABASE_URL must match the isolated automation DB.");
    vi.stubEnv("APP_URL", "https://app.example.test"); vi.stubEnv("EMAIL_FROM", "mail@example.test"); vi.stubEnv("EMAIL_REPLY_TO", "reply@example.test"); vi.stubEnv("SUPPORT_URL", "https://app.example.test/help"); vi.stubEnv("EMAIL_PROVIDER", "fake"); vi.stubEnv("NOTIFICATION_PAYLOAD_KEY", Buffer.alloc(32, 11).toString("base64"));
    userId = (await fixtureDb.user.create({ data: { email: `mail-${suffix}@example.test`, emailVerified: new Date() } })).id;
    orgId = (await fixtureDb.organization.create({ data: { name: "Automation fixture", slug: `mail-${suffix}`, members: { create: { userId, role: "owner" } } } })).id;
  });
  afterAll(async () => {
    await fixtureDb.providerWebhookEvent.deleteMany({ where: { OR: [{ provider: "fake-mail", providerEventId: { in: fakeIds } }, { provider: "resend", providerEventId: { in: webhookIds } }] } });
    await fixtureDb.emailSuppression.deleteMany({ where: { emailHash: emailHash(`mail-${suffix}@example.test`) } });
    if (orgId) await fixtureDb.organization.delete({ where: { id: orgId } });
    if (userId) await fixtureDb.user.delete({ where: { id: userId } });
    await fixtureDb.$disconnect(); vi.unstubAllEnvs();
  });
  const intent = (key: string) => ({ eventType: "identity.password_changed", userId, aggregateType: "User", aggregateId: userId, dedupeKey: `${suffix}:${key}`, payload: { occurredAt: new Date().toISOString() } });

  it("commits business state and intent together, rolling both back on failure", async () => {
    await expect(fixtureDb.$transaction(async tx => { await tx.user.update({ where: { id: userId }, data: { name: "must roll back" } }); await emitEvent(tx, intent("rollback")); throw new Error("fixture rollback"); })).rejects.toThrow("fixture rollback");
    expect((await fixtureDb.user.findUniqueOrThrow({ where: { id: userId } })).name).toBeNull();
    expect(await fixtureDb.outboxEvent.count({ where: { dedupeKey: `${suffix}:rollback` } })).toBe(0);
  });
  it("deduplicates concurrent intent and channel dispatch then sends one logical fake email", async () => {
    const event = (await Promise.all(Array.from({ length: 8 }, () => fixtureDb.$transaction(tx => emitEvent(tx, intent("concurrent"))))))[0];
    await Promise.all(Array.from({ length: 8 }, () => runOutboxTick({ eventId: event.id })));
    const channels = await fixtureDb.notification.findMany({ where: { outboxEventId: event.id } });
    expect(channels).toHaveLength(2);
    const mail = channels.find(row => row.channel === "EMAIL")!;
    const inapp = channels.find(row => row.channel === "IN_APP")!;
    expect(inapp.secretPayloadEnc).toBeNull(); expect(inapp.recipientEmail).toBeNull();
    await Promise.all(Array.from({ length: 8 }, () => runNotificationTick({ notificationId: mail.id, provider: fake })));
    const accepted = await fixtureDb.notification.findUniqueOrThrow({ where: { id: mail.id } });
    fakeIds.push(accepted.providerMessageId!);
    expect(accepted.status).toBe("accepted"); expect(accepted.deliveredAt).toBeNull();
    expect(await fixtureDb.notificationAttempt.count({ where: { notificationId: mail.id } })).toBe(1);
    expect((await getFakeMailPreview(accepted.providerMessageId!))?.to).toBe(`mail-${suffix}@example.test`);

    const raw = JSON.stringify({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: accepted.providerMessageId, to: [`mail-${suffix}@example.test`], from: "mail@example.test", subject: "fixture private" } });
    const id = `fixture-${suffix}`; webhookIds.push(id);
    const secret = Buffer.alloc(32, 12); vi.stubEnv("EMAIL_WEBHOOK_SECRET", `whsec_${secret.toString("base64")}`);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${createHmac("sha256", secret).update(`${id}.${timestamp}.${raw}`).digest("base64")}` });
    await acceptEmailWebhook(raw, headers); await acceptEmailWebhook(raw, headers); await processEmailWebhookInbox();
    expect(await fixtureDb.providerWebhookEvent.count({ where: { provider: "resend", providerEventId: id } })).toBe(1);
    expect((await fixtureDb.notification.findUniqueOrThrow({ where: { id: mail.id } })).status).toBe("delivered");
  });
  it("recovers a crash after provider acceptance using the original frozen payload and idempotency key", async () => {
    const event = await fixtureDb.$transaction(tx => emitEvent(tx, intent("ambiguous")));
    await runOutboxTick({ eventId: event.id });
    const mail = await fixtureDb.notification.findFirstOrThrow({ where: { outboxEventId: event.id, channel: "EMAIL" } });
    const crash = { name: "fake", get: fake.get.bind(fake), send: async (...args: Parameters<typeof fake.send>) => { const result = await fake.send(...args); fakeIds.push(result.messageId); throw new ProviderError("ambiguous", "fixture_crash_after_acceptance"); } };
    await runNotificationTick({ notificationId: mail.id, provider: crash });
    const retry = await fixtureDb.notification.findUniqueOrThrow({ where: { id: mail.id } });
    expect(retry.status).toBe("retry"); expect(retry.providerPayloadEnc).not.toBeNull();
    await runNotificationTick({ notificationId: mail.id, provider: fake, now: new Date(Date.now() + 120000) });
    const accepted = await fixtureDb.notification.findUniqueOrThrow({ where: { id: mail.id } });
    expect(accepted.status).toBe("accepted"); expect(accepted.providerMessageId).toBe(fakeIds.at(-1));
    expect(await fixtureDb.providerWebhookEvent.count({ where: { provider: "fake-mail", providerEventId: accepted.providerMessageId! } })).toBe(1);
    expect(await fixtureDb.notificationAttempt.count({ where: { notificationId: mail.id } })).toBe(2);
  });
  it("purges expired encrypted proof envelopes while preserving a safe in-app recovery notice", async () => {
    const expiry = new Date(Date.now() + 60000);
    const event = await fixtureDb.$transaction(tx => emitEvent(tx, { ...intent("expiry"), eventType: "identity.password_reset_requested", secret: { id: "fixture-proof", token: "fixture-secret" }, secretExpiresAt: expiry }));
    await runOutboxTick({ eventId: event.id });
    const mail = await fixtureDb.notification.findFirstOrThrow({ where: { outboxEventId: event.id, channel: "EMAIL" } });
    await fixtureDb.notification.update({ where: { id: mail.id }, data: { providerPayloadEnc: encryptPayload({ text: "fixture-secret" }, `provider:${mail.id}`), providerPayloadExpiresAt: expiry } });
    await runNotificationReconciliationTick({ now: new Date(expiry.getTime() + 1), provider: fake });
    const purged = await fixtureDb.notification.findUniqueOrThrow({ where: { id: mail.id } });
    expect(purged.secretPayloadEnc).toBeNull(); expect(purged.providerPayloadEnc).toBeNull(); expect(purged.status).toBe("expired");
    expect((await fixtureDb.notification.findFirstOrThrow({ where: { outboxEventId: event.id, channel: "IN_APP" } })).status).toBe("available");
  });
  it("applies suppression to necessary security mail without losing committed business state", async () => {
    await fixtureDb.emailSuppression.create({ data: { emailHash: emailHash(`mail-${suffix}@example.test`), reason: "hard_bounce", provider: "fixture", occurredAt: new Date() } });
    const event = await fixtureDb.$transaction(tx => emitEvent(tx, intent("suppression")));
    await runOutboxTick({ eventId: event.id });
    const mail = await fixtureDb.notification.findFirstOrThrow({ where: { outboxEventId: event.id, channel: "EMAIL" } });
    await runNotificationTick({ notificationId: mail.id, provider: fake });
    expect((await fixtureDb.notification.findUniqueOrThrow({ where: { id: mail.id } })).status).toBe("suppressed");
    expect(await fixtureDb.notificationAttempt.count({ where: { notificationId: mail.id } })).toBe(0);
    expect(await fixtureDb.user.count({ where: { id: userId } })).toBe(1);
  });
});
