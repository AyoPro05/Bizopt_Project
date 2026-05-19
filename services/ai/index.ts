import { db } from "@/lib/db";

export async function generateContent(
  orgId: string,
  prompt: string,
  options?: { tone?: string; platforms?: string[] }
) {
  const record = await db.aiGeneration.create({
    data: {
      orgId,
      prompt,
      status: "processing",
      model: "bizopt-v1",
    },
  });

  const tone = options?.tone ?? "professional";
  const platforms = options?.platforms?.join(", ") ?? "all networks";

  const output = [
    `**${tone.charAt(0).toUpperCase() + tone.slice(1)} caption** (${platforms})`,
    "",
    buildCaptionFromPrompt(prompt, tone),
    "",
    "—",
    "Suggested hashtags: #BizOpt #SocialGrowth #SmallBusiness",
  ].join("\n");

  const updated = await db.aiGeneration.update({
    where: { id: record.id },
    data: { output, status: "completed" },
  });

  return updated;
}

function buildCaptionFromPrompt(prompt: string, tone: string): string {
  const base = prompt.trim().slice(0, 280);
  if (tone === "bold") return `🔥 ${base} — Ready to grow? Let's go.`;
  if (tone === "casual") return `Hey! ${base} What do you think?`;
  if (tone === "friendly") return `✨ ${base} We'd love to hear from you!`;
  return `${base}`;
}

export async function getAiHistory(orgId: string, limit = 20) {
  return db.aiGeneration.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
