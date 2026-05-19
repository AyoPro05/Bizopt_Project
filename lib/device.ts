import { hashDeviceFingerprint } from "./crypto";
import { DEVICE_LIMIT_DEFAULT } from "./constants";

export type DevicePayload = {
  fingerprint: string;
  label?: string;
  platform?: string;
};

export function normalizeFingerprint(raw: string): string {
  return hashDeviceFingerprint(raw.trim().toLowerCase());
}

export function isWithinDeviceLimit(boundCount: number, limit = DEVICE_LIMIT_DEFAULT): boolean {
  return boundCount < limit;
}

export function deviceHeadersFromRequest(req: Request): DevicePayload | null {
  const fingerprint = req.headers.get("x-device-fingerprint");
  if (!fingerprint) return null;
  return {
    fingerprint,
    label: req.headers.get("x-device-label") ?? undefined,
    platform: req.headers.get("x-device-platform") ?? undefined,
  };
}
