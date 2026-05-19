import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { retryPost } from "@/services/publishing";
import { safeJson } from "@/lib/helpers";
import { z } from "zod";

const schema = z.object({ postId: z.string() });

export async function POST(req: Request) {
  const ctx = await getApiContext({ requireEntitlement: true, requireDevice: true }, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const post = await retryPost(parsed.data.postId, ctx.org.id);
  return NextResponse.json({ post });
}
