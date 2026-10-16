import { getPlatformContext } from "@/lib/platform-context";
import { requireSupportStaff } from "@/services/support/access";
import { supportError, supportJson } from "@/lib/support-http";
import { listStaffTickets } from "@/services/support/tickets";
import { statuses } from "@/services/support/schemas";
export async function GET(req: Request) {
  try {
    const staff = await requireSupportStaff(req, await getPlatformContext(req));
    const search = new URL(req.url).searchParams;
    const status = search.get("status");
    return supportJson({ staff, tickets: await listStaffTickets(staff, search.get("q") ?? "", statuses.includes(status as typeof statuses[number]) ? status! : undefined) });
  } catch (error) { return supportError(error); }
}
