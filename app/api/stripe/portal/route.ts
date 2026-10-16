import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, platformError } from "@/lib/platform-http";
import { createPortalSession } from "@/services/billing/checkout";
import { requireVerifiedBillingUser } from "@/services/billing/access";
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const { org, userId } = await getPlatformContext(req, "billing.manage");
    await requireVerifiedBillingUser(userId);
    const portal = await createPortalSession(org.id);
    return NextResponse.json({ url: portal.url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
