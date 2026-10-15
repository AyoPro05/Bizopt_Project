// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { Resend } from "resend";
import { ResendEmailProvider } from "@/services/notifications/provider";

describe("installed Resend transport contract without network", () => {
  const message = { from: "mail@example.test", replyTo: "reply@example.test", to: "person@example.test", subject: "Fixture", html: "<p>Fixture</p>", text: "Fixture", retentionExpiresAt: "2026-01-01T00:00:00Z" };
  afterEach(() => vi.unstubAllGlobals());
  it("sends the stable provider header and immutable visible payload with an abort deadline", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-fixture" }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    const provider = new ResendEmailProvider(new Resend("fixture-only-not-a-live-key"));
    await expect(provider.send(message, "bizopt-fixture")).resolves.toMatchObject({ messageId: "provider-fixture" });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails"); expect(options.headers.get("Idempotency-Key")).toBe("bizopt-fixture"); expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options.body)).toEqual({ from: message.from, to: message.to, reply_to: message.replyTo, subject: message.subject, html: message.html, text: message.text });
  });
  it("distinguishes safe retry, known rejection and ambiguous network failure", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const provider = new ResendEmailProvider(new Resend("fixture-only"));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ name: "concurrent_idempotent_requests", statusCode: 409, message: "raw-private-detail" }), { status: 409 }));
    await expect(provider.send(message, "stable")).rejects.toMatchObject({ kind: "retryable" });
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ name: "invalid_idempotency_key", statusCode: 400, message: "raw-private-detail" }), { status: 400 }));
    await expect(provider.send(message, "stable")).rejects.toMatchObject({ kind: "permanent" });
    fetch.mockRejectedValueOnce(new Error("raw-private-detail"));
    await expect(provider.send(message, "stable")).rejects.toMatchObject({ kind: "ambiguous", message: "Email provider did not confirm acceptance." });
  });
  it("bounds metadata reconciliation reads and never returns provider message content", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "provider-fixture", last_event: "delivered", html: "sensitive", text: "sensitive" }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    const provider = new ResendEmailProvider(new Resend("fixture-only")); expect(await provider.get("provider-fixture")).toEqual({ status: "delivered" });
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
