import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { canUseAiStudio } from "@/lib/permissions";
import { selectVariant } from "@/services/ai/generate-variants";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const access = await canUseAiStudio(ctx.org.id);
  if (!access.allowed) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 });
  }

  const variant = await selectVariant(ctx.org.id, id);
  return NextResponse.json({ variant });
}
