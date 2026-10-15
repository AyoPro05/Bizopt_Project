import type { Prisma } from "@prisma/client";
import { Resend, type WebhookEventPayload } from "resend";
import { db } from "@/lib/db";
import { emailHash } from "./crypto";
import { retryAt } from "@/services/automation/dispatcher";

type Receipt = { messageId: string; status: string; occurredAt: string; recipientHashes: string[]; suppressReason?: string };
const statuses: Record<string, string> = { "email.sent": "accepted", "email.delivered": "delivered", "email.delivery_delayed": "delayed", "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed", "email.suppressed": "suppressed" };

export async function acceptEmailWebhook(rawBody: string, headers: Headers): Promise<{ accepted: true }> {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  const id = headers.get("svix-id") || "";
  if (!secret) throw new Error("Email webhook configuration is incomplete.");
  if (Buffer.byteLength(rawBody) > 262144 || !id || id.length > 200) throw new Error("Invalid email webhook.");
  let event: WebhookEventPayload;
  try {
    event = new Resend("webhook-verification-only").webhooks.verify({ payload: rawBody, headers: { id, timestamp: headers.get("svix-timestamp") || "", signature: headers.get("svix-signature") || "" }, webhookSecret: secret });
  } catch { throw new Error("Invalid email webhook signature."); }
  const status = statuses[event.type];
  // Ignore opens/clicks and unrelated provider events; no tracking data is stored.
  if (!status || !("email_id" in event.data)) return { accepted: true };
  const occurred = new Date(event.created_at);
  if (!Number.isFinite(occurred.getTime()) || !event.data.email_id || typeof event.data.email_id !== "string") throw new Error("Invalid email delivery event.");
  const recipientHashes = Array.isArray(event.data.to) ? event.data.to.slice(0, 10).filter((value): value is string => typeof value === "string" && value.length <= 254).map(emailHash) : [];
  let suppressReason: string | undefined;
  if (event.type === "email.complained") suppressReason = "complaint";
  if (event.type === "email.bounced" && event.data.bounce?.type?.toLowerCase() === "permanent") suppressReason = "hard_bounce";
  if (event.type === "email.suppressed") suppressReason = "provider_suppressed";
  const receipt: Receipt = { messageId: event.data.email_id, status, occurredAt: occurred.toISOString(), recipientHashes, ...(suppressReason ? { suppressReason } : {}) };
  await db.providerWebhookEvent.upsert({ where: { provider_providerEventId: { provider: "resend", providerEventId: id } }, update: {}, create: { provider: "resend", providerEventId: id, eventType: event.type, payloadJson: receipt } });
  return { accepted: true };
}

const normalize = (status: string): string => ({ sent: "accepted", delivery_delayed: "delayed", canceled: "failed", queued: "accepted", scheduled: "accepted", opened: "delivered", clicked: "delivered" }[status] || status);
export async function applyProviderStatus(tx: Prisma.TransactionClient, messageId: string, inputStatus: string, occurredAt: Date): Promise<boolean> {
  const notification = await tx.notification.findUnique({ where: { providerMessageId: messageId }, select: { id: true, status: true, providerStatusAt: true } });
  if (!notification) return false;
  const status = normalize(inputStatus);
  if (!["accepted", "delivered", "delayed", "bounced", "complained", "failed", "suppressed"].includes(status)) return true;
  if (notification.providerStatusAt && notification.providerStatusAt > occurredAt) return true;
  const terminalRank: Record<string, number> = { delivered: 1, failed: 2, suppressed: 3, bounced: 4, complained: 5 };
  if ((terminalRank[notification.status] || 0) > (terminalRank[status] || 0)) return true;
  if (notification.status === "delivered" && !terminalRank[status]) return true;
  await tx.notification.updateMany({ where: { id: notification.id, status: notification.status, providerStatusAt: notification.providerStatusAt }, data: { status, providerStatusAt: occurredAt, ...(status === "delivered" ? { deliveredAt: occurredAt } : {}), ...(terminalRank[status] ? { secretPayloadEnc: null, providerPayloadEnc: null, leaseUntil: null, leaseToken: null } : {}), ...(status === "bounced" || status === "complained" || status === "suppressed" || status === "failed" ? { failureCode: `provider_${status}` } : {}) } });
  return true;
}

export async function processEmailWebhookInbox(now = new Date()): Promise<number> {
  const due = { availableAt: { lte: now }, OR: [{ status: "pending" }, { status: "processing", processedAt: { lt: new Date(now.getTime() - 90000) } }] };
  const events = await db.providerWebhookEvent.findMany({ where: { provider: "resend", ...due }, orderBy: [{ availableAt: "asc" }, { receivedAt: "asc" }], take: 50 });
  let processed = 0;
  for (const event of events) {
    try {
      await db.$transaction(async tx => {
        const claim = await tx.providerWebhookEvent.updateMany({ where: { id: event.id, ...due }, data: { status: "processing", processedAt: now, attemptCount: { increment: 1 } } });
        if (!claim.count) return;
        const receipt = event.payloadJson as unknown as Receipt;
        if (receipt.suppressReason) for (const hash of receipt.recipientHashes) await tx.emailSuppression.upsert({ where: { emailHash: hash }, update: {}, create: { emailHash: hash, reason: receipt.suppressReason, provider: "resend", occurredAt: new Date(receipt.occurredAt) } });
        const matched = await applyProviderStatus(tx, receipt.messageId, receipt.status, new Date(receipt.occurredAt));
        // A webhook can beat the acceptance write. Keep it durable until correlated.
        const exhausted = event.receivedAt < new Date(now.getTime() - 7 * 86400_000) || (event.attemptCount || 0) + 1 >= 32;
        await tx.providerWebhookEvent.updateMany({ where: { id: event.id, status: "processing", processedAt: now }, data: matched || exhausted ? { status: matched ? "processed" : "unmatched", processedAt: now, lastErrorCode: matched ? null : "correlation_exhausted" } : { status: "pending", processedAt: null, availableAt: retryAt((event.attemptCount || 0) + 1, now), lastErrorCode: "awaiting_notification" } });
        if (matched) processed++;
      });
    } catch {
      await db.providerWebhookEvent.updateMany({ where: { id: event.id, ...due }, data: { status: (event.attemptCount || 0) + 1 >= 8 ? "dead_letter" : "pending", processedAt: null, attemptCount: { increment: 1 }, availableAt: retryAt((event.attemptCount || 0) + 1, now), lastErrorCode: "receipt_processing_failed" } });
    }
  }
  return processed;
}
