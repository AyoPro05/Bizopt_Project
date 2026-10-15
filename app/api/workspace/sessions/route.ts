import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { createWorkspaceSession, listResumableSessions } from "@/services/workspace/session";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const sessions = await listResumableSessions(org.id, session.user.id);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const body = await req.json();
  const workspaceSession = await createWorkspaceSession(org.id, session.user.id, body);

  return NextResponse.json(workspaceSession);
}
