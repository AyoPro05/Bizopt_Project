import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { getWorkspaceSession, updateWorkspaceSession } from "@/services/workspace/session";

type RouteContext = { params: Promise<{ id: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const ctx = await getPlatformContext(req);
    return NextResponse.json(await getWorkspaceSession((await params).id, { orgId: ctx.org.id, userId: ctx.userId }), { headers });
  } catch (error) { return platformError(error); }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    mutationGuard(req);
    const ctx = await getPlatformContext(req, "content.write");
    const updated = await updateWorkspaceSession((await params).id, await readJson(req, 32768), { orgId: ctx.org.id, userId: ctx.userId });
    return NextResponse.json(updated, { headers });
  } catch (error) { return platformError(error); }
}
