import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import {
  listAudioLayers,
  addAudioLayer,
} from "@/services/media/audio-layers";
import { audioLayerSchema } from "@/lib/validators";
import { safeJson } from "@/lib/helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const layers = await listAudioLayers(ctx.org.id, id);
  return NextResponse.json({ layers });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext(true);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const body = await safeJson<unknown>(req);
  const parsed = audioLayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const layer = await addAudioLayer(ctx.org.id, {
      ...parsed.data,
      mediaAssetId: parsed.data.mediaAssetId ?? id,
    });
    return NextResponse.json({ layer }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
