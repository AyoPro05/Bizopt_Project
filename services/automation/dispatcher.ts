import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { channelsForEvent, getEventDefinition } from "@/services/notifications/policy";
import { eventStillEligible } from "@/services/notifications/guards";

export const LEASE_MS = 90_000;
export const MAX_ATTEMPTS = 8;
export function retryAt(attempt: number, now: Date): Date { return new Date(now.getTime() + Math.min(3600_000, 5000 * 2 ** Math.min(attempt, 10)) + Math.floor(Math.random() * 2000)); }

export async function runOutboxTick(options: { now?: Date; eventId?: string } = {}): Promise<boolean> {
  const now = options.now || new Date();
  const due = { ...(options.eventId ? { id: options.eventId } : {}), availableAt: { lte: now }, OR: [{ processingStatus: "pending" }, { processingStatus: "processing", leaseUntil: { lte: now } }] };
  const event = await db.outboxEvent.findFirst({ where: due, orderBy: { createdAt: "asc" } });
  if (!event) return false;
  const leaseToken = randomUUID();
  const claimed = await db.outboxEvent.updateMany({ where: { id: event.id, ...due }, data: { processingStatus: "processing", leaseToken, leaseUntil: new Date(now.getTime() + LEASE_MS), attemptCount: { increment: 1 } } });
  if (!claimed.count) return false;
  const lease = { id: event.id, processingStatus: "processing", leaseToken };
  if (event.attemptCount >= MAX_ATTEMPTS) {
    await db.outboxEvent.updateMany({ where: lease, data: { processingStatus: "dead_letter", leaseToken: null, leaseUntil: null, secretPayloadEnc: null, lastErrorCode: "attempt_limit" } });
    return true;
  }
  try {
    await db.$transaction(async tx => {
      if (!(await eventStillEligible(tx, event, now))) {
        await tx.outboxEvent.updateMany({ where: lease, data: { processingStatus: "canceled", processedAt: now, leaseUntil: null, leaseToken: null, secretPayloadEnc: null, lastErrorCode: "event_superseded" } });
        return;
      }
      const definition = getEventDefinition(event.eventType);
      const preferences = await tx.notificationPreference.findMany({ where: { userId: event.userId }, select: { channel: true, category: true, enabled: true } });
      const channels = channelsForEvent(event.eventType, preferences);
      const expired = definition.secret && (!event.secretExpiresAt || event.secretExpiresAt <= now);
      await tx.notification.createMany({ skipDuplicates: true, data: channels.map(channel => ({
        orgId: event.orgId, userId: event.userId, outboxEventId: event.id, type: event.eventType, category: definition.category, channel,
        dedupeKey: `${event.dedupeKey}:${channel}`, correlationId: event.correlationId, dataJson: event.payloadJson as Prisma.InputJsonValue,
        recipientEmail: channel === "EMAIL" ? event.recipientEmail : null,
        secretPayloadEnc: channel === "EMAIL" && !expired ? event.secretPayloadEnc : null,
        secretExpiresAt: channel === "EMAIL" ? event.secretExpiresAt : null,
        status: channel === "IN_APP" ? "available" : expired ? "expired" : "queued", failureCode: expired && channel === "EMAIL" ? "secret_expired" : null,
        scheduledAt: now,
      })) });
      const completed = await tx.outboxEvent.updateMany({ where: lease, data: { processingStatus: "processed", processedAt: now, leaseToken: null, leaseUntil: null, secretPayloadEnc: null, lastErrorCode: null } });
      if (!completed.count) throw new Error("Outbox lease lost.");
    });
  } catch {
    await db.outboxEvent.updateMany({ where: lease, data: { processingStatus: event.attemptCount + 1 >= MAX_ATTEMPTS ? "dead_letter" : "pending", availableAt: retryAt(event.attemptCount + 1, now), leaseUntil: null, leaseToken: null, lastErrorCode: "dispatch_failed" } });
  }
  return true;
}
