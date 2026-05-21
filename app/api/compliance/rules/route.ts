import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { listComplianceRules } from "@/services/compliance/rules";

export async function GET() {
  const ctx = await getApiContext({});
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const rules = await listComplianceRules();
  return NextResponse.json({ rules });
}
