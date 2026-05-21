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

  const complianceRules = [
    {
      key: "billing_active",
      title: "Active subscription or trial",
      description: "Workspace must have an active entitlement from Stripe webhooks.",
      severity: "high",
    },
    {
      key: "payment_method_on_file",
      title: "Payment method on file",
      description: "Trial requires a payment method before publishing paid features.",
      severity: "medium",
    },
    {
      key: "device_bound",
      title: "Device bound",
      description: "One active device per subscription for access control.",
      severity: "medium",
    },
    {
      key: "platform_connected",
      title: "Platform connected",
      description: "At least one social platform should be connected for publishing.",
      severity: "low",
    },
    {
      key: "publish_ready",
      title: "Publish ready",
      description: "Cannot schedule posts without a connected platform account.",
      severity: "high",
    },
    {
      key: "refund_policy_ack",
      title: "Billing history",
      description: "Tracks whether the workspace has completed at least one payment.",
      severity: "low",
    },
  ];

  for (const rule of complianceRules) {
    await prisma.complianceRule.upsert({
      where: { key: rule.key },
      create: rule,
      update: {
        title: rule.title,
        description: rule.description,
        severity: rule.severity,
        active: true,
      },
    });
  }

  console.log("Seeded platform registry, changelog, and compliance rules");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
