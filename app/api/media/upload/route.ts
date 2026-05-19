import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-context";
import { uploadAsset } from "@/services/media/assets";

export async function POST(req: Request) {
  const ctx = await getApiContext(true);
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
