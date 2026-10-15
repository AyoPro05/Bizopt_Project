import { AppError } from "@/lib/platform-http";
import { getPlatformContext } from "@/lib/platform-context";
import { supportError, supportJson } from "@/lib/support-http";
import { requireSupportStaff } from "@/services/support/access";
import { db } from "@/lib/db";
import { aggregateDeliveryMetrics } from "@/services/notifications";
export async function GET(req: Request) {
  try {
    const ctx = await getPlatformContext(req); const staff = await requireSupportStaff(req, ctx);
    if (staff.role !== "support_admin") throw new AppError("Delivery operations require a support administrator.",403);
    await db.auditLog.create({ data: { userId: ctx.userId, action: "notifications.delivery_metadata_viewed" } });
    const [metrics, notifications] = await Promise.all([aggregateDeliveryMetrics(), db.notification.findMany({ take: 100, orderBy: { createdAt: "desc" }, select: { id: true, type: true, channel: true, status: true, category: true, attemptCount: true, failureCode: true, createdAt: true, sentAt: true, deliveredAt: true } })]);
    return supportJson({ metrics, notifications });
  } catch (error) { return supportError(error); }
}
