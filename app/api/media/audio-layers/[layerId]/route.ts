import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { updateAudioLayer, removeAudioLayer } from "@/services/media/audio-layers";
import { safeJson } from "@/lib/helpers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ layerId: string }> }
) {
  const { layerId } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await safeJson<{
    startMs?: number;
    volume?: number;
    sortOrder?: number;
  }>(req);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  await updateAudioLayer(ctx.org.id, layerId, body);
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
