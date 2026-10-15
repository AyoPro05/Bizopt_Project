import { randomUUID } from "node:crypto";
import type { OutboxEvent, Prisma } from "@prisma/client";
import { encryptPayload } from "@/services/notifications/crypto";
import { getEventDefinition, sanitizeEventData } from "@/services/notifications/policy";

export interface EmitEventInput {
  eventType: string; dedupeKey: string; userId: string; orgId?: string | null;
  aggregateType: string; aggregateId: string; payload: Prisma.InputJsonValue;
  recipientEmail?: string; secret?: Record<string, string>; secretExpiresAt?: Date;
  availableAt?: Date; correlationId?: string;
}

/** Call inside the same transaction as the business change. No provider calls occur here. */
export async function emitEvent(tx: Prisma.TransactionClient, input: EmitEventInput): Promise<OutboxEvent> {
  const definition = getEventDefinition(input.eventType);
  if (![input.dedupeKey, input.userId, input.aggregateType, input.aggregateId].every(value => typeof value === "string" && value.length > 0 && value.length <= 512)) throw new Error("Invalid notification intent.");
  const payloadJson = sanitizeEventData(input.payload);
  if (input.recipientEmail && (!["identity.email_change_requested", "identity.email_changed"].includes(input.eventType) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.recipientEmail) || input.recipientEmail.length > 254)) throw new Error("Recipient override is restricted to email change security notices.");
  if (input.secret && (!definition.secret || !input.secretExpiresAt || input.secretExpiresAt <= new Date() || input.secretExpiresAt.getTime() > Date.now() + 24 * 3600_000 + 60_000)) throw new Error("Sensitive delivery payload requires a short expiry.");
  if (definition.secret && !input.secret) throw new Error("Proof event requires an encrypted secret.");
  const secretPayloadEnc = input.secret ? encryptPayload(input.secret, `event:${input.dedupeKey}`) : null;
  return tx.outboxEvent.upsert({
    where: { dedupeKey: input.dedupeKey }, update: {},
    create: { eventType: input.eventType, dedupeKey: input.dedupeKey, userId: input.userId, orgId: input.orgId ?? null, aggregateType: input.aggregateType, aggregateId: input.aggregateId, payloadJson, recipientEmail: input.recipientEmail?.trim().toLowerCase(), secretPayloadEnc, secretExpiresAt: input.secretExpiresAt, availableAt: input.availableAt, correlationId: input.correlationId || randomUUID() },
  });
}
