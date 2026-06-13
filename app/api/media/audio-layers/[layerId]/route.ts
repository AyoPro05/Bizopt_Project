import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiContext } from "@/lib/api-context";
import { updateAudioLayer, removeAudioLayer } from "@/services/media/audio-layers";
import { safeJson } from "@/lib/helpers";

const patchAudioLayerSchema = z
  .object({
    startMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
    volume: z.number().min(0).max(2).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ layerId: string }> }
) {
  const { layerId } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await safeJson<unknown>(req);
  const parsed = patchAudioLayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await updateAudioLayer(ctx.org.id, layerId, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ layerId: string }> }
) {
  const { layerId } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  await removeAudioLayer(ctx.org.id, layerId);
  return NextResponse.json({ ok: true });
}
