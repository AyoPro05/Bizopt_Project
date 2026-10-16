// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { emitEvent } from "@/services/automation/events";
import { decryptPayload } from "@/services/notifications/crypto";

describe("transactional notification intent", () => {
  const upsert = vi.fn();
  const tx = { outboxEvent: { upsert } } as unknown as Prisma.TransactionClient;
  const base = { eventType: "identity.password_reset_requested", userId: "user", aggregateType: "User", aggregateId: "user", dedupeKey: "reset:proof", payload: {} };
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NOTIFICATION_PAYLOAD_KEY", Buffer.alloc(32, 1).toString("base64")); upsert.mockImplementation(({ create }) => Promise.resolve({ id: "event", ...create })); });
  afterEach(() => vi.unstubAllEnvs());
  it("writes durable semantic intent on the provided transaction and encrypts expiring secrets", async () => {
    const event = await emitEvent(tx, { ...base, secret: { id: "proof", token: "raw-token" }, secretExpiresAt: new Date(Date.now() + 60000) });
    expect(upsert.mock.calls[0][0].where).toEqual({ dedupeKey: "reset:proof" });
    expect(upsert.mock.calls[0][0].update).toEqual({});
    expect(JSON.stringify(upsert.mock.calls)).not.toContain("raw-token");
    expect(decryptPayload(event.secretPayloadEnc!, `event:${base.dedupeKey}`)).toEqual({ id: "proof", token: "raw-token" });
  });
  it("rejects proof data without a short expiry and raw secrets in public data", async () => {
    await expect(emitEvent(tx, { ...base, secret: { token: "raw-token" } })).rejects.toThrow();
    await expect(emitEvent(tx, { ...base, payload: { token: "raw-token" } })).rejects.toThrow();
    await expect(emitEvent(tx, { ...base, recipientEmail: "stranger@example.test" })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it("discards unreviewed public fields and forbids unknown event types", async () => {
    const event = await emitEvent(tx, { ...base, eventType: "identity.password_changed", payload: { changedAt: "2026-01-01T00:00:00Z", unreviewed: "private" } });
    expect(event.payloadJson).toEqual({ changedAt: "2026-01-01T00:00:00Z" });
    await expect(emitEvent(tx, { ...base, eventType: "marketing.invented" })).rejects.toThrow();
  });
});
