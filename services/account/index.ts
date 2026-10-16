import { emitEvent } from "@/services/automation/events";
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
  const user = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
  if (!user?.emailVerified) throw new AppError("Verify your email before requesting account data or deletion.", 403);
  const subject = kind === "export" ? "Account data export request" : "Account deletion review request";
  return db.$transaction(async tx => {
    const existing = await tx.supportTicket.findFirst({ where: { orgId, userId, category: "privacy", subject, status: { notIn: ["resolved", "closed"] } }, select: { id: true } });
    const ticket = existing ?? await tx.supportTicket.create({ data: { orgId, userId, category: "privacy", subject, description: kind === "deletion" ? "Please review my account deletion request. No account data has been erased. Review ownership transfer, workspace-owned work, billing and applicable retention before execution. Backup erasure follows the verified retention process." : "Please review my account data request. A limited account export excludes workspace-owned content, credentials and internal support notes. Review additional permitted data scope through support.", severity: "normal", workflow: "settings", diagnosticsConsent: false } });
    let aggregateId = ticket.id;
    let shouldNotify = !existing;
    if (kind === "export") {
      const active = await tx.dataExportJob.findFirst({ where: { orgId, userId, sourceTicketId: ticket.id, OR: [{ status: { in: ["pending", "processing"] } }, { status: "ready", expiresAt: { gt: new Date() } }] } });
      if (!active) { const job = await tx.dataExportJob.create({ data: { orgId, userId, sourceTicketId: ticket.id } }); aggregateId = job.id; shouldNotify = true; }
      else shouldNotify = false;
    }
    if (shouldNotify) {
      await tx.auditLog.create({ data: { orgId, userId, action: `account.${kind}_requested`, entity: "SupportTicket", entityId: ticket.id } });
      await emitEvent(tx, { userId, orgId, eventType: kind === "export" ? "account.export_requested" : "account.deletion_requested", aggregateType: "privacy_request", aggregateId, dedupeKey: `privacy-${kind}:${aggregateId}`, payload: {} });
    }
    return { ticketId: ticket.id, status: "received", message: kind === "export" ? "Account export request recorded. Check Settings for preparation and expiry; additional privacy scope remains available in Support." : "Deletion request recorded in Support for review. No data has been erased." };
  }, { isolationLevel: "Serializable" });
}
