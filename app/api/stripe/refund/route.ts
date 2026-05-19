import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg, canManageBilling } from "@/lib/permissions";
import { isRefundEligible, createRefund } from "@/services/billing/refunds";
import { refundRequestSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
  const parsed = refundRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const eligibility = await isRefundEligible(org.id);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason }, { status: 400 });
  }

  const payment = await db.payment.findFirst({
    where: { orgId: org.id, status: "succeeded" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    return NextResponse.json({ error: "No payment to refund" }, { status: 400 });
  }

  try {
    const result = await createRefund(payment.id, parsed.data.reason);
    return NextResponse.json({
      refundId: result.record.id,
      status: result.record.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
