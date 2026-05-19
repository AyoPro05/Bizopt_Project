import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const platforms = [
    {
      key: "linkedin",
      displayName: "LinkedIn",
      supportsCarousel: false,
      supportsAudio: false,
      sortOrder: 1,
    },
    {
      key: "instagram",
      displayName: "Instagram",
      supportsCarousel: true,
      sortOrder: 2,
    },
    {
      key: "facebook",
      displayName: "Facebook",
      supportsCarousel: true,
      sortOrder: 3,
    },
    {
      key: "tiktok",
      displayName: "TikTok",
      supportsVideo: true,
      supportsCarousel: false,
      sortOrder: 4,
    },
    {
      key: "twitter",
      displayName: "X (Twitter)",
      supportsCarousel: false,
      sortOrder: 5,
    },
  ];

  for (const p of platforms) {
    await prisma.platformRegistry.upsert({
      where: { key: p.key },
      create: { ...p, isEnabled: true },
      update: p,
    });
  }

  const entries = [
    {
      id: "seed-1.1.0",
      version: "1.1.0",
      title: "Media & campaign builder",
      body: "Media library with trim/crop, audio layers, carousel builder, platform registry connectors, and @bizopt/core for Apple-ready boundaries.",
      category: "feature",
      publishedAt: new Date("2026-05-19"),
    },
  ];

  for (const entry of entries) {
    await prisma.changelogEntry.upsert({
      where: { id: entry.id },
      create: { ...entry, isPublic: true },
      update: entry,
    });
  }

  console.log("Seeded platform registry and changelog");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
