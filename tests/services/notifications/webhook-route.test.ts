// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { acceptEmailWebhook } = vi.hoisted(() => ({ acceptEmailWebhook: vi.fn() }));
vi.mock("@/services/notifications/webhooks", () => ({ acceptEmailWebhook }));
import { POST } from "@/app/api/webhooks/email/route";

describe("raw email webhook boundary", () => {
  beforeEach(() => { vi.resetAllMocks(); acceptEmailWebhook.mockResolvedValue({ accepted: true }); });
  afterEach(() => vi.restoreAllMocks());
  it("forwards untouched raw content and headers only to the verifier", async () => {
    const raw = '{ "type": "email.delivered", "data": {"private": "fixture"} }\n';
    const response = await POST(new NextRequest("https://app.example.test/api/webhooks/email", { method: "POST", body: raw, headers: { "svix-id": "fixture-id" } }));
    expect(response.status).toBe(200); expect(acceptEmailWebhook.mock.calls[0][0]).toBe(raw); expect(acceptEmailWebhook.mock.calls[0][1].get("svix-id")).toBe("fixture-id");
  });
  it("bounds streamed bodies even when content length is absent", async () => {
    const request = new NextRequest("https://app.example.test/api/webhooks/email", { method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(262145)); controller.close(); } }), duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]);
    expect((await POST(request)).status).toBe(413); expect(acceptEmailWebhook).not.toHaveBeenCalled();
  });
  it("returns provider retryable failure on durable inbox outage without echoing raw details", async () => {
    acceptEmailWebhook.mockRejectedValue(new Error("raw-private-database-detail"));
    const response = await POST(new NextRequest("https://app.example.test/api/webhooks/email", { method: "POST", body: "raw-private-body" }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("raw-private");
  });
});
