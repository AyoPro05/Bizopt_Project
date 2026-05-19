import { db } from "@/lib/db";
import type { Prisma, VariantType } from "@prisma/client";

const VARIANT_SPECS: {
  type: VariantType;
  title: string;
  build: (prompt: string, tone: string) => { body: string; metadata?: Record<string, unknown> };
}[] = [
  {
    type: "caption",
    title: "Primary caption",
    build: (prompt, tone) => ({
      body: formatCaption(prompt, tone),
      metadata: { tone, charCount: prompt.length },
    }),
  },
  {
    type: "carousel_outline",
    title: "Carousel story arc",
    build: (prompt) => ({
      body: [
        "Slide 1 — Hook: Stop scrolling if you care about growth.",
        `Slide 2 — Problem: ${prompt.slice(0, 120)}…`,
        "Slide 3 — Insight: What most brands miss.",
        "Slide 4 — Proof: Results or social proof.",
        "Slide 5 — CTA: Comment or DM to learn more.",
      ].join("\n\n"),
      metadata: { slideCount: 5 },
    }),
  },
  {
    type: "image_prompt",
    title: "Hero image prompt",
    build: (prompt) => ({
      body: `Professional editorial photo, soft natural light, subject illustrating: ${prompt}. Clean background, brand-safe, 4:5 aspect ratio, no text overlay.`,
      metadata: { aspectRatio: "4:5", style: "editorial" },
    }),
  },
  {
    type: "video_idea",
    title: "Short-form video concept",
    build: (prompt) => ({
      body: [
        "0–3s: Pattern interrupt hook (direct to camera).",
        `3–15s: Deliver core idea — ${prompt.slice(0, 100)}.`,
        "15–25s: Quick proof or demo.",
        "25–30s: CTA with on-screen text.",
      ].join("\n"),
      metadata: { durationSec: 30, format: "reels" },
    }),
  },
  {
    type: "audio_idea",
    title: "Audio layer concept",
    build: (prompt) => ({
      body: `Voiceover: Warm, confident tone. Opening line: "Here's what changed everything for us." Background: subtle lo-fi beat at -18dB. SFX: soft whoosh on transitions. Theme: ${prompt.slice(0, 80)}.`,
      metadata: { layers: ["voiceover", "music", "sfx"] },
    }),
  },
  {
    type: "thread",
    title: "LinkedIn / X thread",
    build: (prompt, tone) => ({
      body: [
        `1/ ${formatCaption(prompt, tone)}`,
        "2/ The mistake: posting without a system.",
        "3/ What we changed: idea → multi-format → schedule → measure.",
        "4/ Try this week: one idea, five outputs, one calendar slot.",
        "5/ Follow for more — or save this thread.",
      ].join("\n\n"),
      metadata: { posts: 5 },
    }),
  },
];

function formatCaption(prompt: string, tone: string): string {
  const base = prompt.trim().slice(0, 280);
  if (tone === "bold") return `🔥 ${base}\n\nReady to level up? Drop a comment.`;
  if (tone === "casual") return `Hey — ${base}\n\nWhat's your take?`;
  if (tone === "friendly") return `✨ ${base}\n\nWould love to hear from you!`;
  return `${base}\n\n#BizOpt #Growth`;
}

export async function createBriefWithVariants(
  orgId: string,
  userId: string,
  prompt: string,
  options?: { tone?: string }
) {
  const tone = options?.tone ?? "professional";

  const brief = await db.ideaBrief.create({
    data: {
      orgId,
      userId,
      prompt,
      tone,
      status: "generating",
    },
  });

  const variants = await Promise.all(
    VARIANT_SPECS.map((spec, index) => {
      const { body, metadata } = spec.build(prompt, tone);
      return db.contentVariant.create({
        data: {
          orgId,
          briefId: brief.id,
          type: spec.type,
          title: spec.title,
          body,
          metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
          sortOrder: index,
          isSelected: index === 0,
        },
      });
    })
  );

  await db.ideaBrief.update({
    where: { id: brief.id },
    data: { status: "ready" },
  });

  await db.editorSession.upsert({
    where: { briefId: brief.id },
    create: {
      orgId,
      userId,
      briefId: brief.id,
      entityType: "idea",
      snapshotJson: { prompt, tone, variantIds: variants.map((v) => v.id) },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    update: {
      snapshotJson: { prompt, tone, variantIds: variants.map((v) => v.id) },
      lastSavedAt: new Date(),
    },
  });

  return { brief, variants };
}

export async function getBriefWithVariants(orgId: string, briefId: string) {
  return db.ideaBrief.findFirst({
    where: { id: briefId, orgId },
    include: {
      variants: { orderBy: { sortOrder: "asc" } },
      session: true,
    },
  });
}

export async function listBriefs(orgId: string, limit = 20) {
  return db.ideaBrief.findMany({
    where: { orgId },
    include: { variants: { take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function selectVariant(orgId: string, variantId: string) {
  const variant = await db.contentVariant.findFirst({
    where: { id: variantId, orgId },
  });
  if (!variant) throw new Error("Variant not found");

  await db.contentVariant.updateMany({
    where: { briefId: variant.briefId },
    data: { isSelected: false },
  });

  return db.contentVariant.update({
    where: { id: variantId },
    data: { isSelected: true },
  });
}
