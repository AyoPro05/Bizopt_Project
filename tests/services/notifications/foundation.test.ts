// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trustedAppUrl, safeAppLink, notificationConfig } from "@/services/notifications/config";
import { decryptPayload, encryptPayload, emailHash, signUnsubscribe, verifyUnsubscribe } from "@/services/notifications/crypto";
import { EVENT_DEFINITIONS, notificationMetadata, channelsForEvent } from "@/services/notifications/policy";
import { renderEmail } from "@/services/notifications/templates";

describe("notification foundation", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "https://app.example.test");
    vi.stubEnv("NOTIFICATION_PAYLOAD_KEY", Buffer.alloc(32, 7).toString("base64"));
    vi.stubEnv("EMAIL_FROM", "BizOpt <mail@example.test>");
    vi.stubEnv("EMAIL_REPLY_TO", "reply@example.test");
    vi.stubEnv("SUPPORT_URL", "https://app.example.test/help");
    vi.stubEnv("EMAIL_PROVIDER", "fake");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("builds links only from an explicitly trusted origin", () => {
    expect(trustedAppUrl()).toBe("https://app.example.test");
    expect(safeAppLink("/reset-password")).toBe("https://app.example.test/reset-password");
    for (const value of ["//attacker.test", "https://attacker.test", "/\\attacker.test", "/foo\nbar"]) expect(() => safeAppLink(value)).toThrow();
    vi.stubEnv("APP_URL", "https://user:secret@app.example.test");
    expect(() => trustedAppUrl()).toThrow();
  });
  it("fails closed without a distinct encryption key or configured mail identity", () => {
    vi.stubEnv("NOTIFICATION_PAYLOAD_KEY", "");
    vi.stubEnv("NEXTAUTH_SECRET", "should-never-be-a-fallback");
    expect(() => encryptPayload({ token: "sensitive" }, "outbox:x")).toThrow();
    vi.stubEnv("EMAIL_FROM", "");
    expect(() => notificationConfig()).toThrow();
  });
  it("encrypts with authenticated context and detects tampering", () => {
    const encrypted = encryptPayload({ token: "sensitive" }, "outbox:x");
    expect(encrypted).not.toContain("sensitive");
    expect(decryptPayload(encrypted, "outbox:x")).toEqual({ token: "sensitive" });
    expect(() => decryptPayload(encrypted, "outbox:y")).toThrow();
    expect(encryptPayload({ token: "sensitive" }, "outbox:x")).not.toBe(encrypted);
    expect(emailHash("  Person@Example.test ")).toBe(emailHash("person@example.test"));
  });
  it("requires optional category consent independently for each channel", () => {
    expect(channelsForEvent("identity.password_changed", [])).toEqual(["EMAIL", "IN_APP"]);
    expect(channelsForEvent("publishing.failed", [])).toEqual([]);
    expect(channelsForEvent("publishing.failed", [{ category: "OPERATIONAL", channel: "IN_APP", enabled: true }])).toEqual(["IN_APP"]);
    expect(channelsForEvent("billing.renewed", [{ category: "BILLING", channel: "EMAIL", enabled: false }])).toEqual(["EMAIL", "IN_APP"]);
  });
  it("signs an expiring purpose-bound optional unsubscribe confirmation", () => {
    const token = signUnsubscribe("user1", "OPERATIONAL", new Date("2026-01-02"));
    expect(verifyUnsubscribe(token, new Date("2026-01-01"))).toMatchObject({ userId: "user1", category: "OPERATIONAL" });
    expect(() => verifyUnsubscribe(token, new Date("2026-01-03"))).toThrow();
    expect(() => signUnsubscribe("user1", "SECURITY", new Date())).toThrow();
    expect(() => verifyUnsubscribe(token + "x", new Date("2026-01-01"))).toThrow();
  });
  it("renders escaped HTML and plaintext for every event without preview secrets or invented entitlements", () => {
    for (const eventType of Object.keys(EVENT_DEFINITIONS)) {
      const preview = renderEmail(eventType, { plan: "<script>alert(1)</script>", amountMinor: 99, currency: "usd", recurringAmountMinor: 999, periodStart: "2026-01-01T00:00:00Z", periodEnd: "2026-01-08T00:00:00Z", nextBillingAt: "2026-01-08T00:00:00Z" }, { preview: true });
      expect(preview.html).not.toContain("<script>");
      expect(preview.html).not.toContain("token=");
      expect(preview.text).not.toMatch(/unlimited|free trial/i);
      expect(preview.text).toContain("https://app.example.test/help");
      expect(preview.html).toContain("<html");
      expect(notificationMetadata(eventType, {}).href).not.toMatch(/token|https:/);
    }
  });
  it("places proof secrets only in fragments of trusted email links", () => {
    const email = renderEmail("identity.password_reset_requested", {}, { secret: { id: "proof-id", token: "raw-secret" }, secretExpiresAt: new Date("2026-01-01") });
    expect(email.text).toContain("https://app.example.test/reset-password#id=proof-id&token=raw-secret");
    expect(notificationMetadata("identity.password_reset_requested", {}).href).toBe("/forgot-password");
    expect(() => renderEmail("identity.password_reset_requested", {})).toThrow();
  });
  it("preserves only safe internal callbacks before the proof fragment", () => {
    const options = { secret: { id: "proof", token: "secret" }, secretExpiresAt: new Date("2026-01-01") };
    expect(renderEmail("identity.verification_requested", { callbackUrl: "/billing?plan=base" }, options).text).toContain("/verify-email?callbackUrl=%2Fbilling%3Fplan%3Dbase#id=proof&token=secret");
    expect(renderEmail("identity.verification_requested", { callbackUrl: "//attacker.test" }, options).text).not.toContain("attacker.test");
  });
  it("shows accurate configured billing amounts and dates and rejects foreign invoice URLs", () => {
    const email = renderEmail("billing.introductory_active", { plan: "Base", amountMinor: 99, currency: "usd", recurringAmountMinor: 999, periodStart: "2026-01-01T00:00:00Z", periodEnd: "2026-01-08T00:00:00Z", nextBillingAt: "2026-01-08T00:00:00Z", invoiceUrl: "https://attacker.test/token" });
    expect(email.text).toContain("$0.99");
    expect(email.text).toContain("$9.99");
    expect(email.text).toContain("until canceled");
    expect(email.text).not.toContain("attacker.test");
    expect(renderEmail("billing.monthly_active", { amountMinor: 999, currency: "jpy" }).text).toContain("¥999");
  });
});
