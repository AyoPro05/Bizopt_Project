import { db } from "./db";
import { FREE_AI_GENERATIONS_LIMIT } from "./constants";
import { normalizeFingerprint } from "./device";

export type OrgRole = "owner" | "admin" | "member";

export async function getUserOrgMembership(userId: string, orgId: string) {
  return db.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
}

export async function getUserPrimaryOrg(userId: string) {
  const membership = await db.orgMember.findFirst({
    where: { userId },
    include: {
      org: {
        include: {
          entitlement: true,
          subscription: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return membership?.org ?? null;
}

export function canManageBilling(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function canPublish(role: string): boolean {
  return ["owner", "admin", "member"].includes(role);
}

export async function requireActiveEntitlement(orgId: string): Promise<boolean> {
  const entitlement = await db.entitlement.findUnique({ where: { orgId } });
  if (!entitlement) return false;

  const allowedStates = ["active", "trialing", "grace_period"];
  if (!entitlement.active && !allowedStates.includes(entitlement.userFacingState)) {
    return false;
  }
  if (entitlement.accessUntil && entitlement.accessUntil < new Date()) {
    if (entitlement.userFacingState !== "grace_period") return false;
  }
  return allowedStates.includes(entitlement.userFacingState);
}

export async function canUseAiStudio(orgId: string): Promise<{
  allowed: boolean;
  paid: boolean;
  remainingFree?: number;
}> {
  const entitled = await requireActiveEntitlement(orgId);
  if (entitled) return { allowed: true, paid: true };

  const used = await db.ideaBrief.count({ where: { orgId } });
  const remaining = Math.max(0, FREE_AI_GENERATIONS_LIMIT - used);
  if (remaining > 0) {
    return { allowed: true, paid: false, remainingFree: remaining };
  }
  return { allowed: false, paid: false, remainingFree: 0 };
}

export async function verifyOrgOwnsStripeCustomer(
  orgId: string,
  stripeCustomerId: string
): Promise<boolean> {
  const sub = await db.subscription.findUnique({ where: { orgId } });
  if (!sub?.stripeCustomerId) return false;
  return sub.stripeCustomerId === stripeCustomerId;
}

export async function requireDeviceBound(
  orgId: string,
  rawFingerprint: string
): Promise<boolean> {
  const fingerprint = normalizeFingerprint(rawFingerprint);
  const device = await db.device.findFirst({
    where: { orgId, fingerprint, revokedAt: null },
  });
  return !!device;
}
