import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPrimaryOrg } from "@/lib/permissions";
import { retryPost } from "@/services/publishing";
import { safeJson } from "@/lib/helpers";
import { z } from "zod";

const schema = z.object({ postId: z.string() });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getUserPrimaryOrg(session.user.id);
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const post = await retryPost(parsed.data.postId, org.id);
  return NextResponse.json({ post });
}
