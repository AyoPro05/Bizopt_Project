export type PlatformCapability = {
  supportsImage: boolean;
  supportsVideo: boolean;
  supportsCarousel: boolean;
  supportsAudio: boolean;
};

export type PlatformRegistryEntry = {
  key: string;
  displayName: string;
  capabilities: PlatformCapability;
  isEnabled: boolean;
  sortOrder: number;
};

export type PublishPayload = {
  caption?: string;
  mediaUrls: string[];
  scheduledAt?: string;
  carouselSlideUrls?: string[];
};

export type PublishResult = {
  success: boolean;
  externalId?: string;
  errorMessage?: string;
};
