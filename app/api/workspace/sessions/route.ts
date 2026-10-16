import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/platform-context";
import { mutationGuard, readJson, platformError } from "@/lib/platform-http";
import { createWorkspaceSession, listResumableSessions } from "@/services/workspace/session";

export async function GET(req: Request) {
  try {
    const ctx = await getPlatformContext(req);
    return NextResponse.json({ sessions: await listResumableSessions(ctx.org.id, ctx.userId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}

export async function POST(req: Request) {
  try {
    mutationGuard(req);
    const ctx = await getPlatformContext(req, "content.write");
    return NextResponse.json(await createWorkspaceSession(ctx.org.id, ctx.userId, await readJson(req, 32768)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return platformError(error); }
}
