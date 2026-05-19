import { cookies } from "next/headers";
import { db } from "./db";
import { THEME_COOKIE } from "./constants";
import type { ThemeMode } from "@prisma/client";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(mode: ThemeMode, prefersDark = false): ResolvedTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return prefersDark ? "dark" : "light";
}

export async function getUserTheme(userId: string): Promise<ThemeMode> {
  const settings = await db.userSettings.findUnique({ where: { userId } });
  return settings?.theme ?? "system";
}

export async function getThemeFromCookie(): Promise<ThemeMode | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(THEME_COOKIE)?.value;
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return null;
}

export async function ensureUserSettings(userId: string) {
  return db.userSettings.upsert({
    where: { userId },
    create: { userId, theme: "system" },
    update: {},
  });
}
