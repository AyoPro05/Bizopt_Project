import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { getEnabledPlatforms } from "@/services/platforms/registry";

export async function GET(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const platforms = await getEnabledPlatforms();
  return NextResponse.json({ platforms });
}
