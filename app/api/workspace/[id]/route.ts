import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { getWorkspaceSession, updateWorkspaceSession } from "@/services/workspace/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const { id } = await params;
  const workspaceSession = await getWorkspaceSession(id);

  if (!workspaceSession || workspaceSession.orgId !== org.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(workspaceSession);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) {
    return NextResponse.json({ error: "No org" }, { status: 400 });
  }

  const { id } = await params;
  const body = await req.json();
  const updated = await updateWorkspaceSession(id, body);

  if (updated.orgId !== org.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(updated);
}
