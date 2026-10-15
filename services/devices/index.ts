import { randomUUID } from "node:crypto";
import { emitEvent } from "@/services/automation/events";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeFingerprint } from "@/lib/device";
import { DEVICE_LIMIT_DEFAULT } from "@/lib/constants";

const perPerson = () => process.env.TEAM_DEVICE_POLICY !== "workspace_legacy";
const scopeFor = (orgId: string, userId?: string) => ({ orgId, ...(perPerson() ? { userId: userId ?? "__missing_identity__" } : {}) });
type Meta = { label?: string; platform?: string };

export async function bindDevice(orgId: string, rawFingerprint: string, meta?: Meta, userId?: string) {
  if (!userId) return { ok: false as const, error: "identity_required", code: 401 };
  return db.$transaction(async (tx) => {
    const member = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    if (!member || !["owner", "admin", "member"].includes(member.role)) return { ok: false as const, error: "workspace_access_revoked", code: 403 };
    const entitlement = await tx.entitlement.findUnique({ where: { orgId } });
    if (!entitlement || !["active", "trialing", "grace_period"].includes(entitlement.userFacingState) || (entitlement.accessUntil && entitlement.accessUntil < new Date())) return { ok: false as const, error: "subscription_inactive", code: 403 };
    const scope = scopeFor(orgId, userId);
    const fingerprint = normalizeFingerprint(rawFingerprint);
    const existing = await tx.device.findFirst({ where: { ...scope, fingerprint } });
    if (existing && !existing.revokedAt) {
      const device = await tx.device.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), ...meta } });
      return { ok: true as const, device, rebind: false };
    }
    const count = await tx.device.count({ where: { ...scope, revokedAt: null } });
    const limit = perPerson() ? DEVICE_LIMIT_DEFAULT : entitlement.deviceLimit;
    if (count >= limit) return { ok: false as const, error: "device_limit_reached", code: 403 };
    const data = { orgId, userId: perPerson() ? userId : null, fingerprint, ...meta, isPrimary: true, revokedAt: null, lastSeenAt: new Date() };
    const device = existing ? await tx.device.update({ where: { id: existing.id }, data }) : await tx.device.create({ data });
    return { ok: true as const, device, rebind: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function rebindDevice(orgId: string, oldFingerprint: string, newFingerprint: string, meta?: Meta, userId?: string) {
  if (!userId) return { ok: false as const, error: "identity_required", code: 401 };
  return db.$transaction(async (tx) => {
    const member = await tx.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
    const entitlement = await tx.entitlement.findUnique({ where: { orgId } });
    if (!member || !["owner", "admin", "member"].includes(member.role) || !entitlement || !["active", "trialing", "grace_period"].includes(entitlement.userFacingState) || (entitlement.accessUntil && entitlement.accessUntil < new Date())) return { ok: false as const, error: "subscription_inactive", code: 403 };
    const scope = scopeFor(orgId, userId);
    const old = await tx.device.findFirst({ where: { ...scope, fingerprint: normalizeFingerprint(oldFingerprint), revokedAt: null } });
    if (!old) return { ok: false as const, error: "device_not_found", code: 404 };
    const fingerprint = normalizeFingerprint(newFingerprint);
    const existing = await tx.device.findFirst({ where: { ...scope, fingerprint } });
    const operationId = randomUUID();
    await emitEvent(tx, { userId, orgId, aggregateType: "device", aggregateId: old.id, eventType: "device.rebind_requested", dedupeKey: `device-rebind-requested:${operationId}`, payload: { occurredAt: new Date().toISOString() } });
    await tx.device.update({ where: { id: old.id }, data: { revokedAt: new Date() } });
    const data = { orgId, userId: perPerson() ? userId : null, fingerprint, ...meta, revokedAt: null, isPrimary: true, lastSeenAt: new Date() };
    const device = existing ? await tx.device.update({ where: { id: existing.id }, data }) : await tx.device.create({ data });
    await emitEvent(tx, { userId, orgId, aggregateType: "device", aggregateId: device.id, eventType: "device.rebound", dedupeKey: `device-rebound:${operationId}`, payload: { occurredAt: new Date().toISOString() } });
    return { ok: true as const, device, rebind: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getDeviceStatus(orgId: string, rawFingerprint: string, userId?: string) {
  const scope = scopeFor(orgId, userId);
  const [device, entitlement, boundCount] = await Promise.all([
    db.device.findFirst({ where: { ...scope, fingerprint: normalizeFingerprint(rawFingerprint), revokedAt: null } }),
    db.entitlement.findUnique({ where: { orgId } }),
    db.device.count({ where: { ...scope, revokedAt: null } }),
  ]);
  return { bound: !!device, device, boundCount, deviceLimit: perPerson() ? DEVICE_LIMIT_DEFAULT : entitlement?.deviceLimit ?? DEVICE_LIMIT_DEFAULT, entitlementActive: entitlement?.active ?? false, userFacingState: entitlement?.userFacingState ?? "pending_payment" };
}

export async function listDevices(orgId: string, userId?: string) {
  return db.device.findMany({ where: { ...scopeFor(orgId, userId), revokedAt: null }, orderBy: { boundAt: "desc" } });
}
