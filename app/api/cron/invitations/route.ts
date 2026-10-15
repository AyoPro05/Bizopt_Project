import { timingSafeEqual } from "node:crypto";
import { processInviteDelivery } from "@/services/workspace/delivery";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "Scheduler unavailable." }, { status: 503 });
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json({ processed: await processInviteDelivery() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Invitation worker unavailable." }, { status: 503 }); }
}
