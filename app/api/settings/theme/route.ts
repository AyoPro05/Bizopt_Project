import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureUserSettings } from "@/lib/theme";
import { THEME_COOKIE } from "@/lib/constants";
import { safeJson } from "@/lib/helpers";

const schema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await ensureUserSettings(session.user.id);
  return NextResponse.json({ theme: settings.theme });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await safeJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await db.userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      theme: parsed.data.theme,
      themeUpdatedAt: new Date(),
    },
    update: {
      theme: parsed.data.theme,
      themeUpdatedAt: new Date(),
    },
  });

  const res = NextResponse.json({ theme: settings.theme });
  const cookieTheme =
    parsed.data.theme === "dark"
      ? "dark"
      : parsed.data.theme === "light"
        ? "light"
        : "light";
  res.cookies.set(THEME_COOKIE, cookieTheme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
