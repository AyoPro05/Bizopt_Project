import { db } from "./db";

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
  return allowedStates.includes(entitlement.userFacingState) || entitlement.active;
}
