// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { workspaceInvite: { findFirst: vi.fn(), updateMany: vi.fn() }, orgMember: { findUnique: vi.fn() }, organization: { findUnique: vi.fn() }, entitlement: { findUnique: vi.fn() }, auditLog: { create: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
import { processInviteDelivery } from "@/services/workspace/delivery";
describe("approved invitation delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv("TEAM_INVITATIONS_ENABLED", "true"); vi.stubEnv("INVITE_TOKEN_SECRET", "local-test-prf-key-with-at-least-32-characters"); vi.stubEnv("RESEND_API_KEY", "fixture-only"); vi.stubEnv("INVITE_FROM_EMAIL", "fixture@example.test"); vi.stubEnv("INVITE_APP_ORIGIN", "https://app.example.test");
    db.workspaceInvite.findFirst.mockResolvedValue({ id: "invite", orgId: "org", generation: "nonce", createdBy: "owner", email: "approved@example.test", role: "member", attempts: 0, expiresAt: new Date(Date.now() + 100000) }); db.workspaceInvite.updateMany.mockResolvedValue({ count: 1 }); db.orgMember.findUnique.mockResolvedValue({ role: "owner" }); db.organization.findUnique.mockResolvedValue({ name: "Fixture workspace" }); db.entitlement.findUnique.mockResolvedValue({ userFacingState: "active", accessUntil: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "mail-fixture" }), { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("sends only the approved recipient with a stable provider idempotency key and no query token", async () => {
    await processInviteDelivery();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(init?.body)); expect(payload.to).toEqual(["approved@example.test"]); expect(payload.text).toContain("/invite#id=invite&token="); expect(init?.headers).toMatchObject({ "Idempotency-Key": "invite-invite-nonce" });
    expect(db.workspaceInvite.updateMany.mock.lastCall?.[0].data).toMatchObject({ deliveryStatus: "sent", providerMessageId: "mail-fixture" });
  });
  it("does not send after inviter authority is removed", async () => { db.orgMember.findUnique.mockResolvedValue(null); await processInviteDelivery(); expect(fetch).not.toHaveBeenCalled(); });
  it("does not send without owning the generation lease", async () => { db.workspaceInvite.updateMany.mockResolvedValue({ count: 0 }); await processInviteDelivery(); expect(fetch).not.toHaveBeenCalled(); });
  it("bounds retries and keeps raw provider errors out of durable records", async () => { vi.mocked(fetch).mockRejectedValue(new Error("secret")); db.workspaceInvite.findFirst.mockResolvedValue({ id: "invite", orgId: "org", generation: "nonce", role: "member", attempts: 2, expiresAt: new Date(Date.now()+1000) }); await processInviteDelivery(); expect(db.workspaceInvite.updateMany.mock.lastCall?.[0].data.deliveryStatus).toBe("failed"); expect(JSON.stringify(db.workspaceInvite.updateMany.mock.lastCall)).not.toContain("secret"); });
});
