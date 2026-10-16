import { createHash } from "node:crypto";
import { Resend, type GetEmailResponseSuccess } from "resend";
import { db } from "@/lib/db";
import { notificationConfig } from "./config";
import { decryptPayload, encryptPayload } from "./crypto";

export interface EmailMessage { from: string; replyTo: string; to: string; subject: string; html: string; text: string; retentionExpiresAt?: string }
export interface DeliveryAcceptance { messageId: string; acceptedAt: Date }
export interface EmailProvider { name: string; send(message: EmailMessage, idempotencyKey: string): Promise<DeliveryAcceptance>; get(messageId: string): Promise<{ status: string } | null> }
export class ProviderError extends Error {
  constructor(public readonly kind: "retryable" | "permanent" | "ambiguous", public readonly code: string) { super("Email provider did not confirm acceptance."); }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private readonly client = new Resend(notificationConfig().apiKey)) {}
  async send(message: EmailMessage, idempotencyKey: string): Promise<DeliveryAcceptance> {
    try {
      // Resend 6 supports a fetch AbortSignal through request options at runtime.
      const { from, replyTo, to, subject, html, text } = message;
      const result = await this.client.emails.send({ from, replyTo, to, subject, html, text }, { idempotencyKey, signal: AbortSignal.timeout(15_000) } as Parameters<Resend["emails"]["send"]>[1]);
      if (result.error) {
        const code = result.error.name;
        if (["rate_limit_exceeded", "daily_quota_exceeded", "monthly_quota_exceeded", "concurrent_idempotent_requests"].includes(code)) throw new ProviderError("retryable", "provider_rate_limited");
        if (["validation_error", "missing_required_field", "invalid_access", "invalid_api_key", "restricted_api_key", "invalid_idempotency_key", "invalid_idempotent_request"].includes(code)) throw new ProviderError("permanent", "provider_rejected");
        throw new ProviderError("ambiguous", "provider_unconfirmed");
      }
      if (!result.data?.id) throw new ProviderError("ambiguous", "provider_unconfirmed");
      return { messageId: result.data.id, acceptedAt: new Date() };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("ambiguous", "provider_timeout");
    }
  }
  async get(messageId: string) {
    const result = await this.client.get<GetEmailResponseSuccess>(`/emails/${encodeURIComponent(messageId)}`, { signal: AbortSignal.timeout(15_000) } as Parameters<Resend["get"]>[1]);
    if (result.error || !result.data) return null;
    return { status: result.data.last_event };
  }
}

/** PostgreSQL-backed fixture mailbox; it cannot send anything on the network. */
export class DurableFakeEmailProvider implements EmailProvider {
  readonly name = "fake";
  async send(message: EmailMessage, idempotencyKey: string): Promise<DeliveryAcceptance> {
    if (process.env.NODE_ENV === "production" || !/^[^\s@]+@(?:[a-z0-9-]+\.)+test$/i.test(message.to)) throw new ProviderError("permanent", "fake_recipient_rejected");
    const messageId = `fake_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 40)}`;
    const digest = createHash("sha256").update(JSON.stringify(message)).digest("hex");
    const retentionExpiresAt = new Date(Math.min(Date.now() + 24 * 3600_000, message.retentionExpiresAt ? new Date(message.retentionExpiresAt).getTime() : Infinity));
    const record = await db.providerWebhookEvent.upsert({ where: { provider_providerEventId: { provider: "fake-mail", providerEventId: messageId } }, update: {}, create: {
      provider: "fake-mail", providerEventId: messageId, eventType: "email.accepted", status: "fixture", processedAt: new Date(), availableAt: retentionExpiresAt,
      payloadJson: { digest, previewEnc: encryptPayload(message, `fake:${messageId}`), expiresAt: retentionExpiresAt.toISOString() },
    } });
    if ((record.payloadJson as { digest?: string }).digest !== digest) throw new ProviderError("permanent", "idempotency_payload_mismatch");
    return { messageId, acceptedAt: record.receivedAt };
  }
  async get(messageId: string) {
    if (process.env.NODE_ENV === "production") return null;
    const record = await db.providerWebhookEvent.findUnique({ where: { provider_providerEventId: { provider: "fake-mail", providerEventId: messageId } } });
    return record ? { status: "sent" } : null;
  }
}

export async function getFakeMailPreview(messageId: string): Promise<EmailMessage | null> {
  if (process.env.NODE_ENV === "production" || process.env.EMAIL_PROVIDER !== "fake") throw new Error("Fixture mailbox is unavailable.");
  const record = await db.providerWebhookEvent.findUnique({ where: { provider_providerEventId: { provider: "fake-mail", providerEventId: messageId } } });
  const data = record?.payloadJson as { previewEnc?: string; expiresAt?: string } | undefined;
  if (!data?.previewEnc || !data.expiresAt || new Date(data.expiresAt) <= new Date()) return null;
  const message = decryptPayload<EmailMessage>(data.previewEnc, `fake:${messageId}`);
  if (!/^[^\s@]+@(?:[a-z0-9-]+\.)+test$/i.test(message.to)) throw new Error("Fixture mailbox is unavailable.");
  return message;
}
export function getEmailProvider(): EmailProvider { return notificationConfig().provider === "fake" ? new DurableFakeEmailProvider() : new ResendEmailProvider(); }
