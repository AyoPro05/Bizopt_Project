import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { getComplianceSummary } from "@/services/compliance/checks";
import { listComplianceFindings } from "@/services/compliance/rules";

export async function GET() {
  const ctx = await getApiContext({});
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const [summary, findings] = await Promise.all([
    getComplianceSummary(ctx.org.id),
    listComplianceFindings(ctx.org.id),
  ]);

  return NextResponse.json({ summary, findings });
}
