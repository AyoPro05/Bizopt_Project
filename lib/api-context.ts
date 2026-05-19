import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg, requireActiveEntitlement } from "@/lib/permissions";

export async function getApiContext(requireEntitlement = false) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "Unauthorized" as const, status: 401 };
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return { error: "No organization" as const, status: 400 };
  }
  if (requireEntitlement) {
    const entitled = await requireActiveEntitlement(org.id);
    if (!entitled) {
      return { error: "Subscription required" as const, status: 402 };
    }
  }
  return { session, org, userId: session.user.id };
}
