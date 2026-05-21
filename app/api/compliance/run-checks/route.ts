import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { runComplianceChecks } from "@/services/compliance/checks";

export async function POST(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const summary = await runComplianceChecks(ctx.org.id, ctx.userId);
  return NextResponse.json(summary);
}
