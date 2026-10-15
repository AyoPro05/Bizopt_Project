import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError, AppError } from "@/lib/platform-http";
import { createCheckoutSession } from "@/services/billing/checkout";
import { checkoutSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const { org, userId, user } = await getPlatformContext(req, "billing.manage");
    if (!user.email) throw new AppError("An account email is required for checkout", 409);
    if (!rateLimit(`billing-checkout:${org.id}`, 10, 60_000).ok) throw new AppError("Please wait before trying checkout again", 429);
    const input = checkoutSchema.parse(await readJson(req, 4096));
    const session = await createCheckoutSession(org.id, userId, user.email, input);
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
