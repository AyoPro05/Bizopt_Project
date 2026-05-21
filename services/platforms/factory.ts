import type { PlatformConnector } from "@bizopt/core";
import { LinkedInConnector } from "./linkedin";
import { MetaConnector } from "./meta";
import { TikTokConnector } from "./tiktok";

const connectors: Record<string, () => PlatformConnector> = {
  linkedin: () => new LinkedInConnector(),
  instagram: () => new MetaConnector("instagram"),
  facebook: () => new MetaConnector("facebook"),
  tiktok: () => new TikTokConnector(),
};

export function getPlatformConnector(platformKey: string): PlatformConnector | null {
  const factory = connectors[platformKey];
  return factory ? factory() : null;
}

export function listConnectorKeys(): string[] {
  return Object.keys(connectors);
}
