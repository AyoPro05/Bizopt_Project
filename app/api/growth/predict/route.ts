import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { predictGrowth } from "@/services/growth/scoring";
import { safeJson } from "@/lib/helpers";

export async function POST(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await safeJson<{ briefId?: string; campaignId?: string }>(req);
  const prediction = await predictGrowth(ctx.org.id, {
    briefId: body?.briefId,
    campaignId: body?.campaignId,
  });

  return NextResponse.json({ prediction });
}
