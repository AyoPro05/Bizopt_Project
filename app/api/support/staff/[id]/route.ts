import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson } from "@/lib/platform-http";
import { requireSupportStaff } from "@/services/support/access";
import { supportError, supportJson } from "@/lib/support-http";
import { staffTicket, staffUpdateTicket } from "@/services/support/tickets";
type Route = { params: Promise<{ id: string }> };
export async function GET(req: Request, route: Route) {
  try {
    const staff = await requireSupportStaff(req, await getPlatformContext(req));
    return supportJson({ ticket: await staffTicket(staff, (await route.params).id) });
  } catch (error) { return supportError(error); }
}
export async function PATCH(req: Request, route: Route) {
  try {
    mutationGuard(req);
    const staff = await requireSupportStaff(req, await getPlatformContext(req));
    return supportJson(await staffUpdateTicket(staff, (await route.params).id, await readJson(req, 12000)));
  } catch (error) { return supportError(error); }
}
