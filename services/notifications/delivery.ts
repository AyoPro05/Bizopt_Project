import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { LEASE_MS, MAX_ATTEMPTS, retryAt } from "@/services/automation/dispatcher";
import { notificationConfig } from "./config";
import { decryptPayload, emailHash, encryptPayload } from "./crypto";
import { eventStillEligible } from "./guards";
import { channelsForEvent, getEventDefinition } from "./policy";
import { getEmailProvider, ProviderError, type EmailMessage, type EmailProvider } from "./provider";
import { renderEmail } from "./templates";
import { applyProviderStatus, processEmailWebhookInbox } from "./webhooks";

export const IDEMPOTENCY_SAFETY_MS = 23 * 3600_000;

export async function runNotificationTick(options: { now?: Date; provider?: EmailProvider; notificationId?: string } = {}): Promise<boolean> {
  const now = options.now || new Date();
  const due = { ...(options.notificationId ? { id: options.notificationId } : {}), channel: "EMAIL" as const, scheduledAt: { lte: now }, OR: [{ status: { in: ["queued", "retry"] } }, { status: "processing", leaseUntil: { lte: now } }] };
  const job = await db.notification.findFirst({ where: due, orderBy: { scheduledAt: "asc" }, include: { event: true } });
  if (!job) return false;
  const leaseToken = randomUUID();
  const claim = await db.notification.updateMany({ where: { id: job.id, ...due }, data: { status: "processing", leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS), attemptCount: { increment: 1 } } });
  if (!claim.count) return false;
  const lease = { id: job.id, status: "processing", leaseToken };
  const attemptNumber = job.attemptCount + 1;
  const finish = async (status: string, failureCode: string, purge = true) => db.notification.updateMany({ where: lease, data: { status, failureCode, leaseUntil: null, leaseToken: null, ...(purge ? { secretPayloadEnc: null, providerPayloadEnc: null } : {}) } });
  let provider: EmailProvider | undefined;
  let attemptStarted = false;
  try {
    if (!(await eventStillEligible(db, job.event, now))) { await finish("canceled", "event_superseded"); return true; }
    const definition = getEventDefinition(job.type);
    if (job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= IDEMPOTENCY_SAFETY_MS) { await finish("reconciliation_required", "idempotency_window"); return true; }
    if (job.attemptCount >= MAX_ATTEMPTS) { await finish("reconciliation_required", "attempt_limit"); return true; }
    if (definition.secret && (!job.secretExpiresAt || job.secretExpiresAt <= now)) { await finish("expired", "secret_expired"); return true; }
    const preferences = await db.notificationPreference.findMany({ where: { userId: job.userId }, select: { channel: true, category: true, enabled: true } });
    if (!channelsForEvent(job.type, preferences).includes("EMAIL")) { await finish("canceled", "preference_disabled"); return true; }
    const user = await db.user.findUnique({ where: { id: job.userId }, select: { email: true } });
    const recipient = job.recipientEmail || user?.email;
    if (!recipient) { await finish("canceled", "recipient_unavailable"); return true; }
    const suppression = await db.emailSuppression.findUnique({ where: { emailHash: emailHash(recipient) } });
    if (suppression) { await finish("suppressed", "recipient_suppressed"); return true; }
    let secret: Record<string, string> | undefined;
    if (definition.secret) {
      if (!job.secretPayloadEnc) { await finish("expired", "secret_unavailable"); return true; }
      secret = decryptPayload<Record<string, string>>(job.secretPayloadEnc, `event:${job.event.dedupeKey}`);
      const proof = await db.identityToken.findUnique({ where: { id: secret.id } });
      const purpose = job.type === "identity.password_reset_requested" ? "PASSWORD_RESET" : job.type === "identity.email_change_requested" ? "EMAIL_CHANGE" : "EMAIL_VERIFICATION";
      if (!proof || proof.userId !== job.userId || proof.purpose !== purpose || proof.consumedAt || proof.expiresAt <= now || proof.targetEmail.toLowerCase() !== recipient.toLowerCase()) { await finish("canceled", "proof_obsolete"); return true; }
    }
    let message: EmailMessage;
    if (job.providerPayloadEnc) {
      message = decryptPayload<EmailMessage>(job.providerPayloadEnc, `provider:${job.id}`);
      if (message.to.toLowerCase() !== recipient.toLowerCase()) { await finish("canceled", "recipient_changed"); return true; }
    } else {
      const config = notificationConfig();
      message = { from: config.from, replyTo: config.replyTo, to: recipient, ...renderEmail(job.type, job.dataJson, { secret, secretExpiresAt: job.secretExpiresAt, userId: job.userId }), ...(job.secretExpiresAt ? { retentionExpiresAt: job.secretExpiresAt.toISOString() } : {}) };
      const frozen = await db.notification.updateMany({ where: { ...lease, providerPayloadEnc: null }, data: { providerPayloadEnc: encryptPayload(message, `provider:${job.id}`), providerPayloadExpiresAt: job.secretExpiresAt || new Date(now.getTime() + 24 * 3600_000), firstAttemptAt: job.firstAttemptAt || now } });
      if (!frozen.count) return true;
    }
    provider = options.provider || getEmailProvider();
    await db.notificationAttempt.create({ data: { notificationId: job.id, attemptNumber, provider: provider.name, outcome: "started", attemptedAt: now } });
    attemptStarted = true;
    const accepted = await provider.send(message, `bizopt-${job.id}`);
    await db.$transaction(async tx => {
      await tx.notificationAttempt.update({ where: { notificationId_attemptNumber: { notificationId: job.id, attemptNumber } }, data: { outcome: "accepted", providerRequestId: accepted.messageId } });
      await tx.notification.updateMany({ where: lease, data: { status: "accepted", sentAt: accepted.acceptedAt, providerMessageId: accepted.messageId, leaseUntil: null, leaseToken: null, failureCode: null, secretPayloadEnc: null, providerPayloadEnc: null } });
    });
  } catch (error) {
    const failure = error instanceof ProviderError ? error : new ProviderError("ambiguous", attemptStarted ? "provider_unconfirmed" : "delivery_unavailable");
    if (attemptStarted) await db.notificationAttempt.update({ where: { notificationId_attemptNumber: { notificationId: job.id, attemptNumber } }, data: { outcome: failure.kind, sanitizedErrorCode: failure.code } });
    const terminal = failure.kind === "permanent" || attemptNumber >= MAX_ATTEMPTS;
    await db.notification.updateMany({ where: lease, data: { status: terminal ? failure.kind === "ambiguous" ? "reconciliation_required" : "dead_letter" : "retry", failureCode: failure.code, scheduledAt: retryAt(attemptNumber, now), leaseUntil: null, leaseToken: null, ...(terminal ? { secretPayloadEnc: null, providerPayloadEnc: null } : {}) } });
  }
  return true;
}

export async function runNotificationReconciliationTick(options: { now?: Date; provider?: EmailProvider } = {}): Promise<{ webhooks: number; checked: number }> {
  const now = options.now || new Date();
  await db.outboxEvent.updateMany({ where: { secretExpiresAt: { lte: now }, secretPayloadEnc: { not: null } }, data: { secretPayloadEnc: null } });
  await db.notification.updateMany({ where: { secretExpiresAt: { lte: now } }, data: { secretPayloadEnc: null } });
  await db.notification.updateMany({ where: { providerPayloadExpiresAt: { lte: now } }, data: { providerPayloadEnc: null } });
  await db.notification.updateMany({ where: { channel: "EMAIL", status: { in: ["queued", "retry", "processing"] }, secretExpiresAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, data: { status: "expired", secretPayloadEnc: null, providerPayloadEnc: null, failureCode: "secret_expired", leaseUntil: null, leaseToken: null } });
  await db.providerWebhookEvent.updateMany({ where: { provider: "fake-mail", availableAt: { lte: now }, status: "fixture" }, data: { payloadJson: {}, status: "purged" } });
  const webhooks = await processEmailWebhookInbox(now);
  const jobs = await db.notification.findMany({ where: { channel: "EMAIL", status: { in: ["accepted", "delayed", "reconciliation_required"] }, providerMessageId: { not: null }, updatedAt: { lt: new Date(now.getTime() - 15 * 60_000) } }, select: { id: true, providerMessageId: true }, orderBy: { updatedAt: "asc" }, take: 25 });
  let checked = 0;
  for (const job of jobs) {
    try {
      const status = await (options.provider || getEmailProvider()).get(job.providerMessageId!);
      if (status) await db.$transaction(tx => applyProviderStatus(tx, job.providerMessageId!, status.status, now));
      checked++;
    } catch { /* Current durable state remains available for the next tick. */ }
  }
  return { webhooks, checked };
}
