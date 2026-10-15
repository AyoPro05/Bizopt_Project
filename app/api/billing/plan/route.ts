import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError, AppError } from "@/lib/platform-http";
import { previewPlanChange, approvePlanChange, cancelScheduledDowngrade } from "@/services/billing/plan-changes";
import { requireVerifiedBillingUser } from "@/services/billing/access";
import { rateLimit } from "@/lib/rate-limit";
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), targetPlan: z.enum(["base", "team"]) }).strict(),
  z.object({ action: z.literal("approve"), quoteId: z.string().min(1).max(100), payloadHash: z.string().length(64) }).strict(),
  z.object({ action: z.literal("cancel_downgrade") }).strict(),
]);
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const { org, userId } = await getPlatformContext(req, "billing.manage");
    await requireVerifiedBillingUser(userId);
    if (!rateLimit(`billing-plan:${org.id}`, 30, 60_000).ok) throw new AppError("Please wait before trying this billing action again", 429);
    const input = inputSchema.parse(await readJson(req, 4096));
    const result = input.action === "preview" ? await previewPlanChange(org.id, userId, input.targetPlan)
      : input.action === "approve" ? await approvePlanChange(org.id, userId, input.quoteId, input.payloadHash)
      : await cancelScheduledDowngrade(org.id, userId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
