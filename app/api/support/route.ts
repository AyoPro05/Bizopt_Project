import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson } from "@/lib/platform-http";
import { supportError, supportJson } from "@/lib/support-http";
import { createTicket, listUserTickets } from "@/services/support/tickets";
import { statuses } from "@/services/support/schemas";

export async function GET(req: Request) {
  try {
    const context = await getPlatformContext(req, "support.read");
    const search = new URL(req.url).searchParams;
    const status = search.get("status");
    return supportJson({ tickets: await listUserTickets(context.org.id, context.userId, search.get("q") ?? "", statuses.includes(status as typeof statuses[number]) ? status! : undefined), emailDelivery: "unavailable" });
  } catch (error) { return supportError(error); }
}
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const context = await getPlatformContext(req, "support.create");
    return supportJson({ ticket: await createTicket(context.org.id, context.userId, await readJson(req, 24000)), emailDelivery: "unavailable" }, 201);
  } catch (error) { return supportError(error); }
}
