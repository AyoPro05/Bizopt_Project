export const APP_NAME = "BizOpt";
export const APP_TAGLINE = "AI content creation and social publishing";

export const BILLING = {
  currency: "usd",
  amountCents: 999,
  trialPriceCents: 99,
  trialDays: 7,
  displayPrice: "$9.99",
  trialDisplayPrice: "$0.99",
  interval: "month" as const,
  planId: "bizopt_pro_monthly",
  gracePeriodDays: Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? 3),
} as const;

export const COMMERCIAL_TERMS = { offerVersion: "2026-10-15", termsVersion: "2026-10-15", renewalDisclosureVersion: "2026-10-15" } as const;

export const USER_FACING_STATES = [
  "pending_payment",
  "trialing",
  "trial_ended",
  "payment_failed",
  "active",
  "past_due",
  "grace_period",
  "canceled",
  "refund_pending",
  "refund_approved",
  "refund_failed",
  "restricted_device",
  "webhook_syncing",
] as const;

export type UserFacingState = (typeof USER_FACING_STATES)[number];

export const PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "twitter"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** One active device per person, independent of workspace seat capacity. */
export const DEVICE_LIMIT_DEFAULT = 1;

/** Free AI briefs before trial/subscription */
export const FREE_AI_GENERATIONS_LIMIT = 3;

export const THEME_COOKIE = "bizopt-theme";

export const CHANGELOG_CATEGORIES = [
  "feature",
  "improvement",
  "fix",
  "security",
] as const;

export const AI_VARIANT_TYPES = [
  "caption",
  "carousel_outline",
  "image_prompt",
  "video_idea",
  "audio_idea",
  "thread",
] as const;
