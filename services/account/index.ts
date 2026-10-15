import { db } from "@/lib/db";
import { CAPABILITY_ROLES, hasCapability } from "@/lib/platform-permissions";
import { getWorkspace } from "@/services/workspace";
import { requirePassword, revokeAccountSessions } from "./sessions";
import { AppError } from "@/services/platform/errors";

export async function getAccount(orgId: string, userId: string, sessionId: string | null) {
  const [user, workspace, sessions, mobileSessions, workspaces, staff, preferences] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, name: true, emailVerified: true } }),
    getWorkspace(orgId, userId),
    db.webSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" }, take: 30, select: { id: true, label: true, createdAt: true, lastUsedAt: true, expiresAt: true } }),
    db.mobileSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true, expiresAt: true } }),
    db.orgMember.findMany({ where: { userId }, include: { org: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } }),
    db.supportStaff.findUnique({ where: { userId }, select: { active: true } }),
    db.userSettings.findUnique({ where: { userId }, select: { supportEmail: true, localDraftRecovery: true } }),
  ]);
  return { user, currentSessionId: sessionId, sessions: sessions.map((s) => ({ ...s, current: s.id === sessionId })), mobileSessions: mobileSessions.map((s) => ({ id: s.id, label: s.deviceLabel ?? "Mobile session", createdAt: s.createdAt, lastUsedAt: s.lastUsedAt ?? s.createdAt, expiresAt: s.expiresAt, current: false })),
    workspace: { id: workspace.id, name: workspace.name, role: workspace.role, planLabel: workspace.plan.label, memberCount: workspace.members.length, canInvite: workspace.canInvite, inviteDisabledReason: workspace.inviteDisabledReason, canManageBilling: hasCapability(workspace.role, "billing.manage") },
    workspaces: workspaces.map((m) => ({ id: m.org.id, name: m.org.name, role: m.role })),
    capabilities: (Object.keys(CAPABILITY_ROLES) as Array<keyof typeof CAPABILITY_ROLES>).filter((c) => hasCapability(workspace.role, c)),
    supportStaff: staff?.active ?? false, preferences: preferences ?? { supportEmail: false, localDraftRecovery: false },
    deletionPolicy: { mode: "review_request", ownerTransferRequired: true, billingReviewRequired: true, backupErasureImmediate: false, privateDataIncludedInRequest: false },
  };
}

export async function updateProfile(userId: string, name: string) {
  await db.user.update({ where: { id: userId }, data: { name } });
}

export async function updatePreferences(userId: string, preferences: { supportEmail: boolean; localDraftRecovery: boolean }) {
  const data = { supportEmail: preferences.supportEmail, localDraftRecovery: preferences.localDraftRecovery };
  await db.userSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

export async function switchWorkspace(userId: string, orgId: string) {
  const member = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
  if (!member || !hasCapability(member.role, "workspace.read")) throw new AppError("Workspace not available.", 404);
  await db.user.update({ where: { id: userId }, data: { activeOrgId: orgId } });
}

export async function revokeSession(userId: string, id: string, password: string) {
  await requirePassword(userId, password);
  const [browser, mobile] = await Promise.all([
    db.webSession.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.mobileSession.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  if (!browser.count && !mobile.count) throw new AppError("Session not found.", 404);
  await db.supportAccessGrant.updateMany({ where: { userId, webSessionId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await db.auditLog.create({ data: { userId, action: "account.session_revoked", entity: "Session", entityId: id } });
}

export async function signOutAll(userId: string, password: string) {
  await requirePassword(userId, password);
  await revokeAccountSessions(userId);
}

export async function privacyRequest(orgId: string, userId: string, kind: "export" | "deletion", password: string) {
  await requirePassword(userId, password);
  const subject = kind === "export" ? "Account data export request" : "Account deletion review request";
  return db.$transaction(async (tx) => {
    const existing = await tx.supportTicket.findFirst({ where: { orgId, userId, category: "privacy", subject, status: { notIn: ["resolved", "closed"] } }, select: { id: true } });
    if (existing) return { ticketId: existing.id, status: "received", message: "Your existing privacy request is available in Support." };
    const ticket = await tx.supportTicket.create({ data: { orgId, userId, category: "privacy", subject, description: kind === "deletion" ? "Please review my account deletion request. No account data has been erased. Review ownership transfer, workspace-owned work, billing and applicable retention before execution. Backup erasure follows the verified retention process." : "Please review a secure export of my account data. No workspace export has been attached or sent. Confirm identity, authorisation and permitted data scope before preparation.", severity: "normal", workflow: "settings", diagnosticsConsent: false } });
    await tx.auditLog.create({ data: { orgId, userId, action: `account.${kind}_requested`, entity: "SupportTicket", entityId: ticket.id } });
    return { ticketId: ticket.id, status: "received", message: "Request recorded in Support for review. No data has been exported or deleted." };
  });
}
