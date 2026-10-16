import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { transitionStage } from "@/services/workspace/session";
import { workspaceCompletionSchema } from "@/services/workspace/schemas";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    mutationGuard(req);
    const ctx = await getPlatformContext(req, "content.write");
    const input = workspaceCompletionSchema.parse(await readJson(req, 32768));
    const updated = await transitionStage((await params).id, input.nextStage, input.updates, { orgId: ctx.org.id, userId: ctx.userId });
    return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
