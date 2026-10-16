// @vitest-environment node
import { randomUUID } from "node:crypto";
import { disposableTestDatabase } from "@/scripts/test-database-config.mjs";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { previewInvitations, confirmInvitations, acceptInvitation, changeMembership, updateInvitation } from "@/services/workspace";
import { invitationToken } from "@/services/workspace/policy";
import { bindDevice } from "@/services/devices";
import { requireCapability } from "@/lib/platform-permissions";
import { createWebSession, revokeAccountSessions, validateWebSession } from "@/services/account/sessions";
import { updatePreferences } from "@/services/account";
import { createTicket, getUserTicket, staffUpdateTicket } from "@/services/support/tickets";
import { encryptTotpSecret, totp } from "@/services/support/mfa";
import { requireSupportStaff, unlockSupport } from "@/services/support/access";
const url = disposableTestDatabase(process.env.PLATFORM_TEST_DATABASE_URL);
const enabled = !!url;
const suffix = randomUUID();
const users: string[] = [];
let orgId = "", otherOrgId = "", owner = "", teammate = "", stranger = "";
describe.skipIf(!enabled)("platform PostgreSQL integration", () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== url) throw new Error("Only the disposable database is allowed.");
    for (const [key, value] of Object.entries({ TEAM_INVITATIONS_ENABLED: "true", TEAM_DEVICE_POLICY: "per_person", INVITE_TOKEN_SECRET: "local-integration-fixture-secret-32-characters", RESEND_API_KEY: "fixture-no-delivery", INVITE_FROM_EMAIL: "fixture@example.test", SUPPORT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") })) vi.stubEnv(key, value);
    for (const label of ["owner", "teammate", "stranger"]) users.push((await db.user.create({ data: { name: label, email: `${label}-${suffix}@example.test`, emailVerified: new Date(), passwordHash: await hash("Fixture-password-42", 4) } })).id);
    [owner, teammate, stranger] = users;
    orgId = (await db.organization.create({ data: { name: "Platform tests", slug: `platform-${suffix}`, members: { create: { userId: owner, role: "owner" } }, entitlement: { create: { active: true, userFacingState: "active", seatLimit: 2 } }, subscription: { create: { status: "active" } } } })).id;
    otherOrgId = (await db.organization.create({ data: { name: "Other tenant", slug: `other-platform-${suffix}`, members: { create: { userId: stranger, role: "owner" } } } })).id;
  });
  afterAll(async () => {
    if (orgId) await db.organization.delete({ where: { id: orgId } });
    if (otherOrgId) await db.organization.delete({ where: { id: otherOrgId } });
    await db.supportAccessGrant.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    vi.unstubAllEnvs();
  });
  it("reserves Base's final seat once and makes approval retries idempotent", async () => {
    const email = (await db.user.findUniqueOrThrow({ where: { id: teammate } })).email;
    const preview = await previewInvitations(orgId, owner, { emails: [email], role: "member" });
    const result = await confirmInvitations(orgId, owner, preview.approvalId);
    expect(result).toHaveLength(1);
    expect(await confirmInvitations(orgId, owner, preview.approvalId)).toHaveLength(1);
    expect(await db.workspaceInvite.count({ where: { orgId, status: "pending" } })).toBe(1);
    await expect(previewInvitations(orgId, owner, { emails: ["extra@example.test"], role: "member" })).rejects.toThrow("capacity");
  });
  it("requires matching verified identity, consumes the token once and switches workspace", async () => {
    const invite = await db.workspaceInvite.findFirstOrThrow({ where: { orgId } });
    const token = invitationToken(invite.id, invite.generation);
    await expect(acceptInvitation(stranger, invite.id, token)).rejects.toThrow("matching verified");
    await db.user.update({ where: { id: teammate }, data: { emailVerified: null } });
    await expect(acceptInvitation(teammate, invite.id, token)).rejects.toThrow("matching verified");
    await db.user.update({ where: { id: teammate }, data: { emailVerified: new Date() } });
    expect(await acceptInvitation(teammate, invite.id, token)).toEqual({ orgId });
    await expect(acceptInvitation(teammate, invite.id, token)).rejects.toThrow("unavailable");
    expect((await db.user.findUniqueOrThrow({ where: { id: teammate } })).activeOrgId).toBe(orgId);
    await expect(requireCapability(orgId, teammate, "billing.manage")).rejects.toThrow();
    await expect(requireCapability(otherOrgId, teammate, "workspace.read")).rejects.toThrow();
  });
  it("allows each person a device while rejecting their second device", async () => {
    expect(await bindDevice(orgId, "owner-browser", {}, owner)).toMatchObject({ ok: true });
    expect(await bindDevice(orgId, "teammate-browser", {}, teammate)).toMatchObject({ ok: true });
    expect(await bindDevice(orgId, "teammate-other", {}, teammate)).toMatchObject({ error: "device_limit_reached" });
    expect(await db.device.count({ where: { orgId, revokedAt: null } })).toBe(2);
  });
  it("keeps ticket bodies and internal notes private and rejects stale replies", async () => {
    const report = await createTicket(orgId, teammate, { requestId: randomUUID(), category: "seo", subject: "Fixture editor issue", description: "An isolated fixture report about saving content", workflow: "seo", diagnosticsConsent: true, diagnostics: { route: "/seo?token=secret", email: "private", browser: "Chromium" } });
    await expect(getUserTicket(orgId, owner, report.id)).rejects.toThrow("not found");
    await expect(getUserTicket(otherOrgId, teammate, report.id)).rejects.toThrow("not found");
    const staff = { userId: owner, role: "support_admin" as const };
    await staffUpdateTicket(staff, report.id, { expectedVersion: 1, body: "Internal-only operational note", internal: true });
    await staffUpdateTicket(staff, report.id, { expectedVersion: 2, body: "Customer-visible answer", internal: false, status: "triaged" });
    await expect(staffUpdateTicket(staff, report.id, { expectedVersion: 1, body: "stale" })).rejects.toThrow("changed");
    const ticket = await getUserTicket(orgId, teammate, report.id);
    expect(ticket.messages.map(message => message.body)).toEqual(["Customer-visible answer"]);
    expect(ticket.diagnostics).toEqual({ route: "/seo", browser: "Chromium" });
  });
  it("requires separate staff enrollment and replay-resistant MFA tied to a revocable session", async () => {
    const session = await createWebSession(owner);
    const ctx = { userId: owner, sessionId: session.id };
    await expect(requireSupportStaff(new Request("https://example.test"), ctx)).rejects.toThrow("privileged support");
    const secret = Buffer.alloc(20, 8);
    await db.supportStaff.create({ data: { userId: owner, role: "support_admin", totpSecretEnc: encryptTotpSecret(secret) } });
    const code = totp(secret, Date.now() / 1000);
    const grant = await unlockSupport(ctx, "Fixture-password-42", code);
    const request = new Request("https://example.test/api/support/staff", { headers: { cookie: `support_access=${grant.token}` } });
    expect(await requireSupportStaff(request, ctx)).toEqual({ userId: owner, role: "support_admin" });
    await expect(unlockSupport(ctx, "Fixture-password-42", code)).rejects.toThrow();
    await revokeAccountSessions(owner);
    expect(await validateWebSession(owner, session.id, session.version)).toBe(false);
    await expect(requireSupportStaff(request, ctx)).rejects.toThrow("Unlock");
    await expect(createWebSession(owner, true)).rejects.toThrow("Sign in again");
  });
  it("saves only explicitly selected preference fields", async () => {
    await updatePreferences(owner, { supportEmail: true, localDraftRecovery: false });
    expect(await db.userSettings.findUnique({ where: { userId: owner } })).toMatchObject({ supportEmail: true, localDraftRecovery: false });
  });
  it("preserves the last owner and removes tenant access and own devices immediately", async () => {
    const current = () => db.organization.findUniqueOrThrow({ where: { id: orgId } });
    const ownerMember = await db.orgMember.findUniqueOrThrow({ where: { orgId_userId: { orgId, userId: owner } } });
    await expect(changeMembership(orgId, owner, { memberId: ownerMember.id, expectedVersion: (await current()).membershipVersion, action: "remove_member" })).rejects.toThrow("last owner");
    const target = await db.orgMember.findUniqueOrThrow({ where: { orgId_userId: { orgId, userId: teammate } } });
    await changeMembership(orgId, owner, { memberId: target.id, expectedVersion: (await current()).membershipVersion, action: "remove_member" });
    await expect(requireCapability(orgId, teammate, "workspace.read")).rejects.toThrow();
    expect(await db.device.count({ where: { orgId, userId: teammate, revokedAt: null } })).toBe(0);
    expect(await db.device.count({ where: { orgId, userId: owner, revokedAt: null } })).toBe(1);
  });
  it("serializes competing reservations and revokes tokens", async () => {
    const a = await previewInvitations(orgId, owner, { emails: ["one@example.test"], role: "member" });
    const b = await previewInvitations(orgId, owner, { emails: ["two@example.test"], role: "member" });
    const outcomes = await Promise.allSettled([confirmInvitations(orgId, owner, a.approvalId), confirmInvitations(orgId, owner, b.approvalId)]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.workspaceInvite.count({ where: { orgId, status: "pending" } })).toBe(1);
    const invite = await db.workspaceInvite.findFirstOrThrow({ where: { orgId, status: "pending" } });
    await updateInvitation(orgId, owner, invite.id, "revoke");
    await expect(acceptInvitation(teammate, invite.id, invitationToken(invite.id, invite.generation))).rejects.toThrow("unavailable");
  });
  it("enforces a scheduled Base ceiling before accepting more Team reservations", async () => {
    await db.entitlement.update({ where: { orgId }, data: { planKey: "team", seatLimit: 5 } });
    await db.subscription.update({ where: { orgId }, data: { selectedPlan: "team", pendingPlan: "base" } });
    await expect(previewInvitations(orgId, owner, { emails: ["one@example.test", "two@example.test"], role: "member" })).rejects.toThrow("Base capacity");
  });
  it("blocks direct browser-role reads and cross-tenant support message foreign keys", async () => {
    const report = await db.supportTicket.findFirstOrThrow({ where: { orgId } });
    await expect(db.supportMessage.create({ data: { orgId: otherOrgId, ticketId: report.id, authorId: stranger, body: "Cross tenant attempt" } })).rejects.toMatchObject({ code: "P2003" });
    await db.$executeRawUnsafe('GRANT SELECT ON "WebSession", "SupportTicket", "WorkspaceInvite" TO seo_browser_check');
    const result = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE seo_browser_check');
      return tx.$queryRawUnsafe<Array<{ count: number }>>('SELECT count(*)::int AS count FROM "SupportTicket"');
    });
    expect(result[0].count).toBe(0);
  });
});
