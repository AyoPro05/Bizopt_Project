export const APP_NAME = "BizOpt";
export const APP_TAGLINE = "AI content creation and social publishing";

export const BILLING = {
  currency: process.env.BILLING_CURRENCY ?? "usd",
  amountCents: Number(process.env.SUBSCRIPTION_AMOUNT_CENTS ?? 999),
  trialPriceCents: Number(process.env.TRIAL_PRICE_CENTS ?? 99),
  trialDays: Number(process.env.TRIAL_DAYS ?? 7),
  displayPrice: "$9.99",
  trialDisplayPrice: "$0.99",
  interval: "month" as const,
  planId: "bizopt_pro_monthly",
  refundWindowDays: 7,
  gracePeriodDays: 3,
} as const;

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

/** One active device per subscription */
export const DEVICE_LIMIT_DEFAULT = 1;

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
