import { db } from "@/lib/db";
import type { PlatformRegistryEntry } from "@bizopt/core";

export async function getEnabledPlatforms(): Promise<PlatformRegistryEntry[]> {
  const rows = await db.platformRegistry.findMany({
    where: { isEnabled: true },
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((r) => ({
    key: r.key,
    displayName: r.displayName,
    isEnabled: r.isEnabled,
    sortOrder: r.sortOrder,
    capabilities: {
      supportsImage: r.supportsImage,
      supportsVideo: r.supportsVideo,
      supportsCarousel: r.supportsCarousel,
      supportsAudio: r.supportsAudio,
    },
  }));
}

export async function getPlatformByKey(key: string) {
  const rows = await getEnabledPlatforms();
  return rows.find((p) => p.key === key) ?? null;
}
