import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { listGrowthRecommendations } from "@/services/growth/recommendations";

export async function GET(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const recommendations = await listGrowthRecommendations(ctx.org.id);
  return NextResponse.json({ recommendations });
}
