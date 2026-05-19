import type { VariantType } from "@prisma/client";

export type BriefContext = {
  prompt: string;
  tone: string;
  goal?: string;
  industry?: string;
  audience?: string;
  platforms?: string[];
};

export type GeneratedVariants = Partial<Record<VariantType, { body: string; metadata?: Record<string, unknown> }>>;

const VARIANT_KEYS: VariantType[] = [
  "caption",
  "carousel_outline",
  "image_prompt",
  "video_idea",
  "audio_idea",
  "thread",
];

export async function generateWithOpenAI(
  ctx: BriefContext
): Promise<GeneratedVariants | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const platformNote =
    ctx.platforms && ctx.platforms.length > 0
      ? `Target platforms: ${ctx.platforms.join(", ")}. Tailor length and style per platform norms.`
      : "Target: LinkedIn and Instagram business accounts.";

  const system = `You are BizOpt, a B2B social media strategist. Output valid JSON only, no markdown.
Keys: caption, carousel_outline, image_prompt, video_idea, audio_idea, thread.
Each value is a string with the full content for that deliverable.`;

  const user = [
    `Business idea: ${ctx.prompt}`,
    `Tone: ${ctx.tone}`,
    ctx.goal ? `Post goal: ${ctx.goal}` : "",
    ctx.industry ? `Industry: ${ctx.industry}` : "",
    ctx.audience ? `Audience: ${ctx.audience}` : "",
    platformNote,
    "carousel_outline: 5 slides labeled Slide 1-5 with hooks and CTA.",
    "thread: 5 numbered posts for LinkedIn/X.",
    "Keep captions under 280 words where appropriate.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Record<string, string>;
    const out: GeneratedVariants = {};
    for (const key of VARIANT_KEYS) {
      if (typeof parsed[key] === "string" && parsed[key].trim()) {
        out[key] = { body: parsed[key].trim() };
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
