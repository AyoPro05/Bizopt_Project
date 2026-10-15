import { NextRequest, NextResponse } from "next/server";
import { acceptEmailWebhook } from "@/services/notifications/webhooks";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || "0") > 262144) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 262144) { await reader.cancel(); return NextResponse.json({ error: "Payload too large." }, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const result = await acceptEmailWebhook(Buffer.concat(chunks).toString("utf8"), request.headers);
    return NextResponse.json(result);
  } catch (error) {
    const invalid = error instanceof Error && /Invalid email/.test(error.message);
    if (invalid) console.warn(JSON.stringify({ event: "email_webhook_signature_invalid" }));
    return NextResponse.json({ error: invalid ? "Invalid webhook." : "Webhook temporarily unavailable." }, { status: invalid ? 400 : 503 });
  }
}
