import { db } from "@/lib/db";
import { AppError } from "@/services/platform/errors";

export const CAPABILITY_ROLES = {
  "workspace.read": ["owner", "admin", "member"],
  "workspace.manage": ["owner", "admin"],
  "workspace.invite": ["owner", "admin"],
  "workspace.owner": ["owner"],
  "billing.manage": ["owner", "admin"],
  "content.write": ["owner", "admin", "member"],
  "support.read": ["owner", "admin", "member"],
  "support.create": ["owner", "admin", "member"],
} as const;
export type Capability = keyof typeof CAPABILITY_ROLES;
export function hasCapability(role: string, capability: Capability): boolean {
  return (CAPABILITY_ROLES[capability] as readonly string[]).includes(role);
}
export async function requireCapability(orgId: string, userId: string, capability: Capability) {
  const member = await db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
  if (!member || !hasCapability(member.role, capability)) throw new AppError("You do not have permission to perform this action.", 403);
  return member;
}
