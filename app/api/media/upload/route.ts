import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { uploadAsset } from "@/services/media/assets";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`upload:${ip}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many uploads." }, { status: 429 });
  }

  const ctx = await getApiContext({ requireEntitlement: true, requireDevice: true }, req);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const asset = await uploadAsset(ctx.org.id, {
      buffer,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
