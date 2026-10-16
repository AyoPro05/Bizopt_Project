import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserPrimaryOrg,
  requireActiveEntitlement,
  requireDeviceBound,
} from "@/lib/permissions";
import { deviceHeadersFromRequest } from "@/lib/device";
import { validateMobileAccess } from "@/lib/mobile-auth";
import { checkSeoMutation } from "@/lib/seo-http";
import { db } from "@/lib/db";

export type ApiContextOptions = {
  requireEntitlement?: boolean;
  requireDevice?: boolean;
};

async function resolveUserId(req?: Request): Promise<string | null> {
  if (req) {
    const header = req.headers.get("authorization");
    if (header) {
      if (!header.startsWith("Bearer ")) return null;
      const mobile = await validateMobileAccess(header.slice(7).trim());
      return mobile?.userId ?? null;
    }
  }

  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function getApiContext(
  options: ApiContextOptions = {},
  req?: Request
) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return { error: "Unauthorized" as const, status: 401 };
  }

  const org = await getUserPrimaryOrg(userId);
  if (!org) {
    return { error: "No organization" as const, status: 400 };
  }

  const membership = await db.orgMember.findUnique({ where: { orgId_userId: { orgId: org.id, userId } } });
  if (!membership || !["owner", "admin", "member"].includes(membership.role)) return { error: "Forbidden" as const, status: 403 };
  if (req && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    try { checkSeoMutation(req); }
    catch { return { error: "Request origin is not allowed" as const, status: 403 }; }
  }

  if (options.requireEntitlement) {
    const entitled = await requireActiveEntitlement(org.id);
    if (!entitled) {
      return { error: "Subscription required" as const, status: 402 };
    }
  }

  if (options.requireDevice && req) {
    const entitled = await requireActiveEntitlement(org.id);
    if (entitled) {
      const device = deviceHeadersFromRequest(req);
      if (!device?.fingerprint) {
        return { error: "Device fingerprint required" as const, status: 403 };
      }
      const bound = await requireDeviceBound(org.id, device.fingerprint, userId);
      if (!bound) {
        return { error: "Device not bound for this workspace" as const, status: 403 };
      }
    }
  }

  return { org, userId };
}
