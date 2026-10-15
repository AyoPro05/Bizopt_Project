import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError, AppError } from "@/lib/platform-http";
import { createRefund } from "@/services/billing/refunds";
import { requireVerifiedBillingUser } from "@/services/billing/access";
import { refundRequestSchema } from "@/lib/validators";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const { org, userId } = await getPlatformContext(req, "billing.manage");
    await requireVerifiedBillingUser(userId);
    if (!rateLimit(`billing-refund:${org.id}`, 5, 60_000).ok) throw new AppError("Please wait before requesting another refund review", 429);
    const input = refundRequestSchema.parse(await readJson(req, 4096));
    const payment = await db.payment.findFirst({ where: { orgId: org.id, status: "succeeded", amountCents: { gt: 0 } }, orderBy: { createdAt: "desc" } });
    if (!payment) throw new AppError("No settled payment is available for refund review", 409);
    const result = await createRefund(payment.id, input.reason);
    return NextResponse.json({ refundId: result.record.id, status: result.record.status }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
