import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserPrimaryOrg,
  requireActiveEntitlement,
  requireDeviceBound,
} from "@/lib/permissions";
import { deviceHeadersFromRequest } from "@/lib/device";
import { verifyAccessToken } from "@/lib/mobile-auth";

export type ApiContextOptions = {
  requireEntitlement?: boolean;
  requireDevice?: boolean;
};

async function resolveUserId(req?: Request): Promise<string | null> {
  if (req) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) {
      const token = header.slice(7).trim();
      const mobile = verifyAccessToken(token);
      if (mobile) return mobile.userId;
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
      const bound = await requireDeviceBound(org.id, device.fingerprint);
      if (!bound) {
        return { error: "Device not bound for this workspace" as const, status: 403 };
      }
    }
  }

  return { org, userId };
}
