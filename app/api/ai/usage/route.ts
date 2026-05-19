import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { canUseAiStudio } from "@/lib/permissions";

export async function GET() {
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const access = await canUseAiStudio(ctx.org.id);
  return NextResponse.json(access);
}
