import { db } from "@/lib/db";
import { normalizeFingerprint, isWithinDeviceLimit } from "@/lib/device";
import { requireActiveEntitlement } from "@/lib/permissions";
import { DEVICE_LIMIT_DEFAULT } from "@/lib/constants";

export async function bindDevice(
  orgId: string,
  rawFingerprint: string,
  meta?: { label?: string; platform?: string }
) {
  const hasAccess = await requireActiveEntitlement(orgId);
  if (!hasAccess) {
    return { ok: false as const, error: "subscription_inactive", code: 403 };
  }

  const fingerprint = normalizeFingerprint(rawFingerprint);
  const existing = await db.device.findUnique({
    where: { orgId_fingerprint: { orgId, fingerprint } },
  });

  if (existing && !existing.revokedAt) {
    await db.device.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), label: meta?.label, platform: meta?.platform },
    });
    return { ok: true as const, device: existing, rebind: false };
  }

  const activeCount = await db.device.count({
    where: { orgId, revokedAt: null },
  });

  const entitlement = await db.entitlement.findUnique({ where: { orgId } });
  const limit = entitlement?.deviceLimit ?? DEVICE_LIMIT_DEFAULT;

  if (!isWithinDeviceLimit(activeCount, limit)) {
    return { ok: false as const, error: "device_limit_reached", code: 403 };
  }

  if (activeCount >= limit) {
    const oldest = await db.device.findFirst({
      where: { orgId, revokedAt: null },
      orderBy: { boundAt: "asc" },
    });
    if (oldest) {
      await db.device.update({
        where: { id: oldest.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  const device = await db.device.create({
    data: {
      orgId,
      fingerprint,
      label: meta?.label,
      platform: meta?.platform,
      isPrimary: activeCount === 0,
    },
  });

  return { ok: true as const, device, rebind: false };
}

export async function rebindDevice(
  orgId: string,
  oldFingerprint: string,
  newFingerprint: string,
  meta?: { label?: string; platform?: string }
) {
  const oldHash = normalizeFingerprint(oldFingerprint);
  const oldDevice = await db.device.findUnique({
    where: { orgId_fingerprint: { orgId, fingerprint: oldHash } },
  });

  if (!oldDevice || oldDevice.revokedAt) {
    return { ok: false as const, error: "device_not_found", code: 404 };
  }

  await db.device.update({
    where: { id: oldDevice.id },
    data: { revokedAt: new Date() },
  });

  return bindDevice(orgId, newFingerprint, meta);
}

export async function getDeviceStatus(orgId: string, rawFingerprint: string) {
  const fingerprint = normalizeFingerprint(rawFingerprint);
  const device = await db.device.findFirst({
    where: { orgId, fingerprint, revokedAt: null },
  });
  const entitlement = await db.entitlement.findUnique({ where: { orgId } });
  const boundCount = await db.device.count({
    where: { orgId, revokedAt: null },
  });

  return {
    bound: !!device,
    device,
    boundCount,
    deviceLimit: entitlement?.deviceLimit ?? DEVICE_LIMIT_DEFAULT,
    entitlementActive: entitlement?.active ?? false,
    userFacingState: entitlement?.userFacingState ?? "pending_payment",
  };
}

export async function listDevices(orgId: string) {
  return db.device.findMany({
    where: { orgId, revokedAt: null },
    orderBy: { boundAt: "desc" },
  });
}
