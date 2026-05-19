import { z } from "zod";
import { isAllowedAppRedirect } from "@/lib/redirect-url";
export const deviceBindSchema = z.object({
  fingerprint: z.string().min(8).max(256),
  label: z.string().max(100).optional(),
  platform: z.string().max(50).optional(),
});

export const campaignCreateSchema = z.object({
  title: z.string().min(1).max(200),
  caption: z.string().max(5000).optional(),
  platforms: z
    .array(z.enum(["instagram", "facebook", "linkedin", "tiktok", "twitter"]))
    .min(1),
  scheduledAt: z.string().datetime().optional(),
  assetIds: z.array(z.string()).optional(),
});

export const aiGenerateSchema = z.object({
  prompt: z.string().min(10).max(4000),
  tone: z.enum(["professional", "casual", "bold", "friendly"]).optional(),
  goal: z
    .enum(["awareness", "leads", "sales", "hiring", "engagement", "launch"])
    .optional(),
  industry: z.string().max(120).optional(),
  audience: z.string().max(200).optional(),
  platforms: z.array(z.string()).max(10).optional(),
});

export const campaignUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  caption: z.string().max(5000).optional(),
  platforms: z
    .array(z.enum(["instagram", "facebook", "linkedin", "tiktok", "twitter"]))
    .min(1)
    .optional(),
  status: z.enum(["draft", "scheduled", "published", "failed"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const refundRequestSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const publishScheduleSchema = z.object({
  campaignId: z.string(),
  scheduledAt: z.string().datetime(),
  platforms: z.array(z.string()).min(1),
});

export const checkoutSchema = z.object({
  successUrl: z
    .string()
    .url()
    .refine(isAllowedAppRedirect, "successUrl must be on app domain")
    .optional(),
  cancelUrl: z
    .string()
    .url()
    .refine(isAllowedAppRedirect, "cancelUrl must be on app domain")
    .optional(),
});

export const mediaEditSchema = z.object({
  operation: z.enum(["trim", "crop", "reorder", "rotate", "filter"]),
  params: z.record(z.unknown()),
});

export const audioLayerSchema = z.object({
  mediaAssetId: z.string().optional(),
  audioAssetId: z.string(),
  startMs: z.number().int().min(0).optional(),
  volume: z.number().min(0).max(2).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const carouselSlideSchema = z.object({
  caption: z.string().max(2200).optional(),
  mediaAssetId: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const carouselReorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});
