import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { listAssets } from "@/services/media/assets";

export async function GET() {
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const assets = await listAssets(ctx.org.id);
  return NextResponse.json({ assets });
}
