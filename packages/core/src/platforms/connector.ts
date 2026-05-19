import type { PublishPayload, PublishResult } from "./types";

/** Platform connector contract — shared by web app and future Apple clients. */
export interface PlatformConnector {
  readonly platformKey: string;
  connect(authCode: string): Promise<{ externalId: string; displayName?: string }>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt?: Date }>;
  publish(
    accessToken: string,
    accountExternalId: string,
    payload: PublishPayload
  ): Promise<PublishResult>;
  validateMedia?(
    mimeType: string,
    sizeBytes: number,
    durationMs?: number
  ): { ok: boolean; reason?: string };
}
