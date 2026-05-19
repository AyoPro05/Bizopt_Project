import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg, canManageBilling } from "@/lib/permissions";
import { createCheckoutSession } from "@/services/billing/checkout";
import { checkoutSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const membership = await db.orgMember.findUnique({
    where: { orgId_userId: { orgId: org.id, userId: session.user.id } },
  });
  if (!membership || !canManageBilling(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await safeJson<unknown>(req);
  const parsed = checkoutSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const checkoutSession = await createCheckoutSession(
      org.id,
      session.user.id,
      session.user.email,
      {
        successUrl: parsed.data.successUrl,
        cancelUrl: parsed.data.cancelUrl,
      }
    );
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
