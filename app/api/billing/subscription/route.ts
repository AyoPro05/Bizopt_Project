import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError, AppError } from "@/lib/platform-http";
import { setSubscriptionCancellation } from "@/services/billing/cancellation";
import { rateLimit } from "@/lib/rate-limit";
const schema = z.object({ action: z.enum(["cancel", "resume"]), confirmed: z.literal(true) }).strict();
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const { org, userId } = await getPlatformContext(req, "billing.manage");
    if (!rateLimit(`billing-cancel:${org.id}`, 10, 60_000).ok) throw new AppError("Please wait before changing cancellation again", 429);
    const input = schema.parse(await readJson(req, 4096));
    const result = await setSubscriptionCancellation(org.id, userId, input.action === "cancel", input.confirmed);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
