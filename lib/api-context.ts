import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getUserPrimaryOrg,
  requireActiveEntitlement,
  requireDeviceBound,
} from "@/lib/permissions";
import { deviceHeadersFromRequest } from "@/lib/device";

export type ApiContextOptions = {
  requireEntitlement?: boolean;
  requireDevice?: boolean;
};

export async function getApiContext(
  options: ApiContextOptions = {},
  req?: Request
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" as const, status: 401 };
  }
  const org = await getUserPrimaryOrg(session.user.id);
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

  return { session, org, userId: session.user.id };
}
