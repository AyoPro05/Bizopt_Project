import { z } from "zod";

export const workspaceStageSchema = z.enum(["idea", "generate", "compare", "edit", "schedule", "publish", "measure"]);
const text = z.string().max(500);
const id = z.string().min(1).max(100);
const platforms = z.array(z.string().min(1).max(50)).max(10);

export const workspaceCreateSchema = z.object({
  ideaPrompt: z.string().trim().min(1).max(10000),
  businessGoal: text.optional(),
  tone: z.string().max(100).optional(),
  industry: text.optional(),
  audience: text.optional(),
  selectedPlatforms: platforms.optional(),
}).strict();

// Editor input is deliberately separate from Prisma's relation/update syntax.
export const workspaceUpdateSchema = workspaceCreateSchema.partial().extend({
  businessGoal: text.nullable().optional(),
  tone: z.string().max(100).nullable().optional(),
  industry: text.nullable().optional(),
  audience: text.nullable().optional(),
  selectedVariantId: id.nullable().optional(),
  compareViewOpen: z.boolean().optional(),
  editingAssetIds: z.array(id).max(50).optional(),
  carouselState: z.record(z.unknown()).nullable().optional(),
  scheduleIntent: z.string().max(1000).nullable().optional(),
  scheduledPlatforms: platforms.optional(),
}).strict();

export const workspaceCompletionSchema = z.object({
  nextStage: workspaceStageSchema,
  updates: workspaceUpdateSchema.optional(),
}).strict();

export const workspaceSnapshotSchema = workspaceUpdateSchema.extend({ stage: workspaceStageSchema }).strict();
export type WorkspaceStage = z.infer<typeof workspaceStageSchema>;
export type WorkspaceUpdate = z.infer<typeof workspaceUpdateSchema>;
