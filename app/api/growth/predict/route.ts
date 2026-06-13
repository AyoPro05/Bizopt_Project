import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiContext } from "@/lib/api-context";
import { predictGrowth } from "@/services/growth/scoring";
import { safeJson } from "@/lib/helpers";

const predictSchema = z.object({
  briefId: z.string().min(1).optional(),
  campaignId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await safeJson<unknown>(req);
  const parsed = predictSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const prediction = await predictGrowth(ctx.org.id, {
    briefId: parsed.data.briefId,
    campaignId: parsed.data.campaignId,
  });

  return NextResponse.json({ prediction });
}
