import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { saveEditorSession, getResumableSessions } from "@/services/editor/draft-session";
import { safeJson } from "@/lib/helpers";
import type { Prisma } from "@prisma/client";

const saveSchema = z.object({
  entityType: z.string(),
  snapshotJson: z.record(z.unknown()),
  briefId: z.string().optional(),
  campaignId: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ sessions: [] });

  const sessions = await getResumableSessions(org.id, session.user.id);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await safeJson<unknown>(req);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const record = await saveEditorSession(org.id, session.user.id, {
    ...parsed.data,
    snapshotJson: parsed.data.snapshotJson as Prisma.InputJsonValue,
  });
  return NextResponse.json({ session: record });
}
