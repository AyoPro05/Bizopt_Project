import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { canUseAiStudio } from "@/lib/permissions";
import { createBriefWithVariants } from "@/services/ai/generate-variants";
import { aiGenerateSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { FREE_AI_GENERATIONS_LIMIT } from "@/lib/constants";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`ai:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 }
    );
  }

  const ctx = await getApiContext({}, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const access = await canUseAiStudio(ctx.org.id);
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: `Start your trial to continue. You used all ${FREE_AI_GENERATIONS_LIMIT} free ideas.`,
        remainingFree: 0,
      },
      { status: 402 }
    );
  }

  const body = await safeJson<unknown>(req);
  const parsed = aiGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createBriefWithVariants(
    ctx.org.id,
    ctx.userId,
    parsed.data.prompt,
    {
      tone: parsed.data.tone,
      goal: parsed.data.goal,
      industry: parsed.data.industry,
      audience: parsed.data.audience,
      platforms: parsed.data.platforms,
    }
  );

  return NextResponse.json({
    brief: result.brief,
    variants: result.variants,
    source: result.source,
    remainingFree: access.paid
      ? undefined
      : Math.max(0, (access.remainingFree ?? FREE_AI_GENERATIONS_LIMIT) - 1),
  });
}
