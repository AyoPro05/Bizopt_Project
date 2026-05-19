import type { PlatformConnector } from "@bizopt/core";
import { LinkedInConnector } from "./linkedin";

const connectors: Record<string, () => PlatformConnector> = {
  linkedin: () => new LinkedInConnector(),
};

export function getPlatformConnector(platformKey: string): PlatformConnector | null {
  const factory = connectors[platformKey];
  return factory ? factory() : null;
}

export function listConnectorKeys(): string[] {
  return Object.keys(connectors);
}
