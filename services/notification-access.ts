import { z } from "zod";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/platform-permissions";
import { AppError } from "@/services/platform/errors";
import { notificationMetadata } from "@/services/notifications/policy";

const scope = (orgId: string, userId: string) => ({ userId, channel: "IN_APP" as const, OR: [{ orgId }, { orgId: null }] });
export async function listPrivateNotifications(orgId: string, userId: string) {
  await requireCapability(orgId, userId, "workspace.read");
  const where = scope(orgId, userId);
  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, type: true, category: true, dataJson: true, createdAt: true, readAt: true } }),
    db.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { notifications: rows.map(({ id, type, category, dataJson, createdAt, readAt }) => ({ id, type, category, createdAt, readAt, ...notificationMetadata(type, dataJson) })), unreadCount };
}
export async function markPrivateNotification(orgId: string, userId: string, id: string) {
  await requireCapability(orgId, userId, "workspace.read");
  const result = await db.notification.updateMany({ where: { id, ...scope(orgId, userId) }, data: { readAt: new Date() } });
  if (!result.count) throw new AppError("Notification not found.", 404);
}
export const preferenceInput = z.object({ channel: z.enum(["EMAIL", "IN_APP"]), category: z.enum(["SECURITY", "BILLING", "OPERATIONAL", "DIGEST", "MARKETING"]), enabled: z.boolean(), timezone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Choose a valid timezone."), digestFrequency: z.enum(["weekly", "off"]).default("weekly") }).strict();
export async function getNotificationPreferences(userId: string) {
  const preferences = await db.notificationPreference.findMany({ where: { userId }, select: { channel: true, category: true, enabled: true, timezone: true, digestFrequency: true } });
  return { preferences, defaults: { SECURITY: true, BILLING: true, OPERATIONAL: false, DIGEST: false, MARKETING: false }, marketingAvailable: false, digestAvailable: false };
}
export async function setNotificationPreference(userId: string, input: unknown) {
  const value = preferenceInput.parse(input);
  if (["SECURITY", "BILLING"].includes(value.category) && !value.enabled) throw new AppError("Security and billing communications are required. Provider suppression still applies.", 409);
  if (value.category === "MARKETING" && value.enabled) throw new AppError("Marketing notifications are unavailable.", 409);
  await db.$transaction(async tx => {
    await tx.notificationPreference.upsert({ where: { userId_channel_category: { userId, channel: value.channel, category: value.category } }, create: { userId, ...value }, update: value });
    await tx.auditLog.create({ data: { userId, action: "notifications.preference_changed", metadata: value } });
  });
}
