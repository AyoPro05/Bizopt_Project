import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg, requireActiveEntitlement } from "@/lib/permissions";
import { listCampaigns, createCampaign } from "@/services/campaigns";
import { campaignCreateSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const campaigns = await listCampaigns(org.id);
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const entitled = await requireActiveEntitlement(org.id);
  if (!entitled) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 });
  }

  const body = await safeJson<unknown>(req);
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await createCampaign(org.id, {
    ...parsed.data,
    scheduledAt: parsed.data.scheduledAt
      ? new Date(parsed.data.scheduledAt)
      : undefined,
  });
  return NextResponse.json({ campaign }, { status: 201 });
}
