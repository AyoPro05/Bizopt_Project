import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { getCampaign, updateCampaign } from "@/services/campaigns";
import { campaignUpdateSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const campaign = await getCampaign(ctx.org.id, id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext({ requireEntitlement: true }, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await safeJson<unknown>(req);
  const parsed = campaignUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = {
    ...parsed.data,
    scheduledAt:
      parsed.data.scheduledAt === null
        ? null
        : parsed.data.scheduledAt
          ? new Date(parsed.data.scheduledAt)
          : undefined,
  };

  await updateCampaign(ctx.org.id, id, data);
  const campaign = await getCampaign(ctx.org.id, id);
  return NextResponse.json({ campaign });
}
