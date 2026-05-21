import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/helpers";
import { refreshMobileSession } from "@/lib/mobile-auth";

const schema = z.object({
  refreshToken: z.string().min(20),
});

export async function POST(req: Request) {
  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "refreshToken required" }, { status: 400 });
  }

  const tokens = await refreshMobileSession(parsed.data.refreshToken);
  if (!tokens) {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  return NextResponse.json({ ...tokens, tokenType: "Bearer" });
}
