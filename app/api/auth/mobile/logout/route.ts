import { NextResponse } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/helpers";
import { revokeMobileSession } from "@/lib/mobile-auth";

const schema = z.object({
  refreshToken: z.string().min(20),
});

export async function POST(req: Request) {
  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "refreshToken required" }, { status: 400 });
  }

  await revokeMobileSession(parsed.data.refreshToken);
  return NextResponse.json({ ok: true });
}
