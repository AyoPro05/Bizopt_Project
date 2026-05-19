import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { schedulePublish } from "@/services/publishing";
import { publishScheduleSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

export async function POST(req: Request) {
  const ctx = await getApiContext({ requireEntitlement: true, requireDevice: true }, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await safeJson<unknown>(req);
  const parsed = publishScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const posts = await schedulePublish(
    ctx.org.id,
    parsed.data.campaignId,
    new Date(parsed.data.scheduledAt),
    parsed.data.platforms
  );
  return NextResponse.json({ posts });
}
