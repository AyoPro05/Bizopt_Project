import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson } from "@/lib/platform-http";
import { supportError, supportJson } from "@/lib/support-http";
import { getUserTicket, replyToTicket } from "@/services/support/tickets";
type Route = { params: Promise<{ id: string }> };
export async function GET(req: Request, route: Route) {
  try {
    const context = await getPlatformContext(req, "support.read");
    return supportJson({ ticket: await getUserTicket(context.org.id, context.userId, (await route.params).id) });
  } catch (error) { return supportError(error); }
}
export async function POST(req: Request, route: Route) {
  try {
    mutationGuard(req);
    const context = await getPlatformContext(req, "support.create");
    return supportJson({ ticket: await replyToTicket(context.org.id, context.userId, (await route.params).id, await readJson(req, 12000)) });
  } catch (error) { return supportError(error); }
}
