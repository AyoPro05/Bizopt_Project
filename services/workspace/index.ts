import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/platform-permissions";
import { AppError } from "@/services/platform/errors";
import { requirePassword } from "@/services/account/sessions";
import { getPlanDefinition } from "@/services/billing/plans";
import { INVITE_TTL_MS, canGrantRole, invitationDeliveryReadiness, invitationToken, tokenDigest, tokenMatches, reservationLimit, validateInviteIdentity } from "./policy";

const inputSchema = z.object({ emails: z.array(z.string().trim().email().max(254)).min(1).max(5), role: z.enum(["admin", "member"]) });
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };
const active = (ent: { active: boolean; userFacingState: string; accessUntil: Date | null } | null) => !!ent && (ent.active || ["trialing", "active", "grace_period"].includes(ent.userFacingState)) && ["trialing", "active", "grace_period"].includes(ent.userFacingState) && (!ent.accessUntil || ent.accessUntil > new Date());
const audit = (orgId: string, userId: string, action: string, entityId: string, metadata?: Prisma.InputJsonValue) => ({ orgId, userId, action, entity: "Workspace", entityId, metadata });

export async function getWorkspace(orgId: string, userId: string) {
  const member = await requireCapability(orgId, userId, "workspace.read");
  const [org, entitlement, subscription, members, invites] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.entitlement.findUnique({ where: { orgId } }),
    db.subscription.findUnique({ where: { orgId } }),
    db.orgMember.findMany({ where: { orgId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    ["owner", "admin"].includes(member.role) ? db.workspaceInvite.findMany({ where: { orgId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, email: true, role: true, status: true, deliveryStatus: true, error: true, expiresAt: true, createdAt: true } }) : [],
  ]);
  const plan = getPlanDefinition(entitlement?.planKey === "team" ? "team" : "base");
  const reason = !["owner", "admin"].includes(member.role) ? "Only an owner or admin can invite teammates." : !active(entitlement) ? "An active workspace subscription is required." : invitationDeliveryReadiness();
  return {
    id: org.id, name: org.name, role: member.role, version: org.membershipVersion,
    plan: { key: plan.key, label: plan.label, capacity: entitlement?.seatLimit ?? 2, futureCapacity: reservationLimit(entitlement, subscription), active: active(entitlement), amountCents: subscription?.amountCents ?? plan.amountCents, currency: subscription?.currency ?? plan.currency, interval: plan.interval, pendingPlanEffectiveAt: subscription?.pendingPlanEffectiveAt },
    members: members.map((m) => ({ id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, role: m.role, createdAt: m.createdAt })),
    invites: invites.map((i) => ({ ...i, status: i.status === "pending" && i.expiresAt <= new Date() ? "expired" : i.status })),
    canInvite: !reason, inviteDisabledReason: reason, mailConfigured: !!process.env.RESEND_API_KEY && !!process.env.INVITE_FROM_EMAIL, devicePolicy: process.env.TEAM_DEVICE_POLICY !== "workspace_legacy" ? "One active device per person" : "One active device per subscription (team policy awaiting approval)",
  };
}

export async function previewInvitations(orgId: string, userId: string, input: unknown) {
  const actor = await requireCapability(orgId, userId, "workspace.invite");
  const parsed = inputSchema.parse(input);
  if (!canGrantRole(actor.role, parsed.role)) throw new AppError("You cannot grant this role.", 403);
  const readiness = invitationDeliveryReadiness();
  if (readiness) throw new AppError(readiness, 503);
  const emails = [...new Set(parsed.emails.map((e) => e.toLowerCase()))].sort();
  const [org, ent, sub, occupied, reserved, conflicts, recent] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId } }), db.entitlement.findUnique({ where: { orgId } }), db.subscription.findUnique({ where: { orgId } }),
    db.orgMember.count({ where: { orgId } }), db.workspaceInvite.count({ where: { orgId, status: "pending", expiresAt: { gt: new Date() } } }),
    db.orgMember.findMany({ where: { orgId, user: { email: { in: emails } } }, select: { id: true } }),
    db.inviteApproval.count({ where: { orgId, createdAt: { gt: new Date(Date.now() - 3_600_000) } } }),
  ]);
  if (!active(ent)) throw new AppError("An active subscription is required to invite teammates.", 402);
  if (recent >= 20) throw new AppError("Invitation limit reached. Try again in an hour.", 429);
  if (conflicts.length || await db.workspaceInvite.count({ where: { orgId, email: { in: emails }, status: "pending", expiresAt: { gt: new Date() } } })) throw new AppError("One or more recipients already have workspace access or a pending invitation. Review the member list.", 409);
  const capacity = reservationLimit(ent, sub);
  if (occupied + reserved + emails.length > capacity) throw new AppError(capacity === 2 ? "These invitations exceed Base capacity. Review an approved Team upgrade in Billing first." : "Team supports up to five people, including the owner. No larger plan is configured.", 409);
  const payload = { emails, role: parsed.role };
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const approval = await db.inviteApproval.create({ data: { orgId, actorId: userId, payload, payloadHash, workspaceVersion: org.membershipVersion, expiresAt: new Date(Date.now() + 5 * 60_000) } });
  return { approvalId: approval.id, expiresAt: approval.expiresAt, recipients: emails, role: parsed.role, workspaceName: org.name, occupied, reserved, capacity, costCents: 0, currency: sub?.currency ?? "usd" };
}

export async function confirmInvitations(orgId: string, userId: string, approvalId: string) {
  const readiness = invitationDeliveryReadiness();
  if (readiness) throw new AppError(readiness, 503);
  return db.$transaction(async (tx) => {
    const actor = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!actor || !["owner", "admin"].includes(actor.role)) throw new AppError("Permission denied.", 403);
    const approval = await tx.inviteApproval.findFirst({ where: { id: approvalId, orgId, actorId: userId } });
    if (!approval) throw new AppError("Invitation preview not found.", 404);
    const select = { id: true, email: true, role: true, status: true, deliveryStatus: true, expiresAt: true };
    if (approval.confirmedAt) return tx.workspaceInvite.findMany({ where: { orgId, approvalId }, select });
    if (approval.expiresAt <= new Date()) throw new AppError("The invitation preview expired. Review it again.", 409);
    const payload = inputSchema.parse(approval.payload);
    if (!canGrantRole(actor.role, payload.role) || tokenDigest(JSON.stringify(payload)) !== approval.payloadHash) throw new AppError("This invitation approval is no longer valid.", 409);
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (org.membershipVersion !== approval.workspaceVersion) throw new AppError("Workspace membership changed. Preview the invitations again.", 409);
    const ent = await tx.entitlement.findUnique({ where: { orgId } });
    const sub = await tx.subscription.findUnique({ where: { orgId } });
    if (!active(ent)) throw new AppError("An active subscription is required.", 402);
    const now = new Date();
    const occupied = await tx.orgMember.count({ where: { orgId } });
    const reserved = await tx.workspaceInvite.count({ where: { orgId, status: "pending", expiresAt: { gt: now } } });
    if (occupied + reserved + payload.emails.length > reservationLimit(ent, sub)) throw new AppError("Workspace capacity changed. Review the invitation preview again.", 409);
    const conflict = await tx.workspaceInvite.count({ where: { orgId, email: { in: payload.emails }, status: "pending", expiresAt: { gt: now } } });
    if (conflict || await tx.orgMember.count({ where: { orgId, user: { email: { in: payload.emails } } } })) throw new AppError("A recipient already has access or a reservation.", 409);
    const result = [];
    for (const email of payload.emails) {
      const id = randomBytes(24).toString("hex");
      const generation = randomBytes(32).toString("hex");
      result.push(await tx.workspaceInvite.create({ data: { id, approvalId, orgId, email, role: payload.role, generation, tokenHash: tokenDigest(invitationToken(id, generation)), createdBy: userId, expiresAt: new Date(now.getTime() + INVITE_TTL_MS) }, select }));
    }
    await tx.inviteApproval.update({ where: { id: approvalId }, data: { confirmedAt: now } });
    await tx.organization.update({ where: { id: orgId }, data: { membershipVersion: { increment: 1 } } });
    await tx.auditLog.create({ data: audit(orgId, userId, "workspace.invitations_approved", approvalId, { recipients: payload.emails, role: payload.role, reserved: payload.emails.length, costCents: 0 }) });
    return result;
  }, serializable);
}

export async function updateInvitation(orgId: string, userId: string, id: string, action: "revoke" | "resend") {
  return db.$transaction(async (tx) => {
    const actor = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!actor || !["owner", "admin"].includes(actor.role)) throw new AppError("Permission denied.", 403);
    const invite = await tx.workspaceInvite.findFirst({ where: { id, orgId } });
    if (!invite || !canGrantRole(actor.role, invite.role)) throw new AppError("Invitation not available.", 404);
    if (action === "resend") {
      const ready = invitationDeliveryReadiness();
      if (ready) throw new AppError(ready, 503);
      if (invite.status !== "pending") throw new AppError("Only pending invitations can be resent.");
      if (Date.now() - invite.updatedAt.getTime() < 60_000) throw new AppError("Wait a minute before resending this invitation.", 429);
      const ent = await tx.entitlement.findUnique({ where: { orgId } });
      const sub = await tx.subscription.findUnique({ where: { orgId } });
      if (!active(ent)) throw new AppError("An active subscription is required.", 402);
      const occupied = await tx.orgMember.count({ where: { orgId } });
      const reserved = await tx.workspaceInvite.count({ where: { orgId, id: { not: id }, status: "pending", expiresAt: { gt: new Date() } } });
      if (occupied + reserved + 1 > reservationLimit(ent, sub)) throw new AppError("This invitation no longer fits workspace capacity.", 409);
    }
    const generation = randomBytes(32).toString("hex");
    await tx.workspaceInvite.update({ where: { id }, data: action === "revoke" ? { status: "revoked", deliveryStatus: "cancelled", lockedAt: null } : { generation, tokenHash: tokenDigest(invitationToken(id, generation)), expiresAt: new Date(Date.now() + INVITE_TTL_MS), deliveryStatus: "queued", attempts: 0, nextAttemptAt: new Date(), lockedAt: null, error: null } });
    await tx.organization.update({ where: { id: orgId }, data: { membershipVersion: { increment: 1 } } });
    await tx.auditLog.create({ data: audit(orgId, userId, `workspace.invitation_${action}`, id) });
  }, serializable);
}

export async function previewInvitationToken(id: string, token: string) {
  const invite = await db.workspaceInvite.findUnique({ where: { id }, include: { org: { select: { name: true } } } });
  if (!invite || !tokenMatches(token, invite.tokenHash) || invite.status !== "pending" || invite.expiresAt <= new Date()) throw new AppError("This invitation is unavailable or has expired. Ask the inviter for a new invitation.", 410);
  return { workspaceName: invite.org.name, emailHint: `${invite.email[0]}***@${invite.email.split("@")[1]}`, role: invite.role, expiresAt: invite.expiresAt };
}

export async function acceptInvitation(userId: string, id: string, token: string) {
  if (process.env.TEAM_DEVICE_POLICY === "workspace_legacy") throw new AppError("The approved per-person device policy must be enabled before accepting teammates.", 503);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    const invite = await tx.workspaceInvite.findUnique({ where: { id } });
    if (!user || !invite || !tokenMatches(token, invite.tokenHash) || invite.expiresAt <= new Date() || invite.status !== "pending") throw new AppError("This invitation is unavailable or has expired.", 410);
    validateInviteIdentity(invite.email, user);
    const inviter = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId: invite.orgId, userId: invite.createdBy } } });
    if (!inviter || !canGrantRole(inviter.role, invite.role)) throw new AppError("The invitation is no longer authorised.", 410);
    const ent = await tx.entitlement.findUnique({ where: { orgId: invite.orgId } });
    const sub = await tx.subscription.findUnique({ where: { orgId: invite.orgId } });
    if (!active(ent)) throw new AppError("The workspace subscription needs attention before this invitation can be accepted.", 402);
    const occupied = await tx.orgMember.count({ where: { orgId: invite.orgId } });
    const reserved = await tx.workspaceInvite.count({ where: { orgId: invite.orgId, id: { not: id }, status: "pending", expiresAt: { gt: new Date() } } });
    const existing = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId: invite.orgId, userId } } });
    if (!existing && occupied + reserved + 1 > reservationLimit(ent, sub)) throw new AppError("Workspace capacity changed. Ask the owner to review this invitation.", 409);
    if (!existing) await tx.orgMember.create({ data: { orgId: invite.orgId, userId, role: invite.role } });
    const changed = await tx.workspaceInvite.updateMany({ where: { id, orgId: invite.orgId, status: "pending", tokenHash: invite.tokenHash }, data: { status: "accepted", acceptedBy: userId, acceptedAt: new Date() } });
    if (!changed.count) throw new AppError("This invitation was already used.", 409);
    await tx.user.update({ where: { id: userId }, data: { activeOrgId: invite.orgId } });
    await tx.organization.update({ where: { id: invite.orgId }, data: { membershipVersion: { increment: 1 } } });
    await tx.auditLog.create({ data: audit(invite.orgId, userId, "workspace.invitation_accepted", id) });
    return { orgId: invite.orgId };
  }, serializable);
}

export async function changeMembership(orgId: string, userId: string, input: { memberId: string; expectedVersion: number; action: "remove_member" | "change_role" | "transfer_ownership"; role?: "admin" | "member"; password?: string }) {
  if (input.action === "transfer_ownership") await requirePassword(userId, input.password ?? "");
  return db.$transaction(async (tx) => {
    const actor = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    const target = await tx.orgMember.findFirst({ where: { id: input.memberId, orgId } });
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (!actor || !target || !["owner", "admin"].includes(actor.role)) throw new AppError("Permission denied.", 403);
    if (org.membershipVersion !== input.expectedVersion) throw new AppError("Membership changed. Refresh and review this action again.", 409);
    if (input.action === "transfer_ownership") {
      if (actor.role !== "owner" || target.userId === userId) throw new AppError("Only an owner can transfer ownership to a teammate.", 403);
      await tx.orgMember.update({ where: { id: target.id }, data: { role: "owner" } });
      await tx.orgMember.update({ where: { id: actor.id }, data: { role: "admin" } });
    } else {
      if (target.role === "owner" && await tx.orgMember.count({ where: { orgId, role: "owner" } }) <= 1) throw new AppError("Transfer ownership before removing or demoting the last owner.", 409);
      if (actor.role !== "owner" && (target.role !== "member" || input.role === "admin")) throw new AppError("You cannot change a teammate with these powers.", 403);
      if (input.action === "remove_member") {
        await tx.orgMember.delete({ where: { id: target.id } });
        await tx.device.updateMany({ where: { orgId, userId: target.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.workspaceInvite.updateMany({ where: { orgId, createdBy: target.userId, status: "pending" }, data: { status: "revoked", deliveryStatus: "cancelled", lockedAt: null } });
      } else {
        if (!input.role || !canGrantRole(actor.role, input.role)) throw new AppError("You cannot grant this role.", 403);
        await tx.orgMember.update({ where: { id: target.id }, data: { role: input.role } });
      }
    }
    await tx.organization.update({ where: { id: orgId }, data: { membershipVersion: { increment: 1 } } });
    await tx.auditLog.create({ data: audit(orgId, userId, `workspace.${input.action}`, target.id, { role: input.role ?? "", workspaceOwnedContentRetained: true }) });
  }, serializable);
}
