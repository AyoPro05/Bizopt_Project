import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { getGrowthDashboard } from "@/services/growth/scoring";
import { listGrowthSnapshots } from "@/services/growth/recommendations";

export async function GET(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const url = new URL(req.url);
  const history = url.searchParams.get("history") === "1";

  const dashboard = await getGrowthDashboard(ctx.org.id);
  if (!history) {
    return NextResponse.json(dashboard);
  }

  const snapshots = await listGrowthSnapshots(ctx.org.id);
  return NextResponse.json({ ...dashboard, snapshots });
}
